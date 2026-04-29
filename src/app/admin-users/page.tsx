'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/authStore';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api';

interface AdminUser {
  id: string;
  loginId: string;
  name: string;
  tier: 'dev' | 'super' | 'admin';
  hasPassword: boolean;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const router = useRouter();

  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyPwd, setVerifyPwd] = useState('');
  const [verifyErr, setVerifyErr] = useState('');

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  // 권한 체크 + dev 는 재인증 자동 통과
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      router.replace('/');
      return;
    }
    if (user.tier !== 'dev' && user.tier !== 'super') {
      router.replace('/');
      return;
    }
    if (user.tier === 'dev') {
      setVerified(true);
    }
  }, [user, router]);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin-users');
      if (res.ok) setAdmins(await res.json());
      else toast('관리자 목록 조회 실패', 'error');
    } catch {
      toast('네트워크 오류', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (verified) fetchAdmins();
  }, [verified, fetchAdmins]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setVerifyErr('');
    try {
      const res = await apiFetch('/api/auth/verify-admin-password', {
        method: 'POST',
        body: JSON.stringify({ password: verifyPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVerified(true);
        setVerifyPwd('');
      } else {
        setVerifyErr(data.error || '비밀번호 확인 실패');
      }
    } catch {
      setVerifyErr('네트워크 오류');
    } finally {
      setVerifying(false);
    }
  };

  const isDev = user?.tier === 'dev';
  const isSuper = user?.tier === 'super';

  // 행 단위 수정/삭제 가능 여부
  // - dev: dev 외 모두 가능 (dev 본인 자체 보호)
  // - super: admin 만 가능
  const canMutate = (target: AdminUser): boolean => {
    if (isDev) return target.tier !== 'dev';
    if (isSuper) return target.tier === 'admin';
    return false;
  };

  // ── 재인증 화면 ──
  if (!verified) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">🔐 관리자 인증 필요</h1>
          <p className="text-sm text-gray-500 mb-5">
            계정 관리는 민감한 작업입니다. 본인 비밀번호를 한 번 더 입력해주세요.
          </p>
          <form onSubmit={handleVerify} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">비밀번호</span>
              <input
                type="password"
                value={verifyPwd}
                onChange={e => setVerifyPwd(e.target.value)}
                className="input mt-1"
                placeholder="본인 비밀번호"
                autoFocus
                required
              />
            </label>
            {verifyErr && <p className="text-sm text-red-600 font-medium">{verifyErr}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => router.push('/')} className="btn-ghost-lg flex-1">취소</button>
              <button type="submit" disabled={verifying} className="btn-primary-lg flex-1">
                {verifying ? '확인 중...' : '확인'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── 본 화면 ──
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 계정</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isDev
              ? '개발자 권한 — 모든 관리자 추가/수정/삭제 가능'
              : '슈퍼관리자 권한 — 일반 관리자만 추가/수정/삭제 가능 (다른 슈퍼관리자는 개발자만 관리)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          관리자 추가
        </button>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">등록된 관리자가 없습니다.</p>
        ) : (
          <>
            {/* 데스크톱: 테이블 */}
            <table className="w-full text-sm hidden lg:table">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">로그인 ID</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">이름</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">권한</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map(a => {
                  const mutable = canMutate(a);
                  const blockReason = isSuper && a.tier === 'super' ? '슈퍼관리자는 개발자만 관리 가능' : !isDev && !isSuper ? '권한 없음' : '';
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{a.loginId}</td>
                      <td className="px-3 py-2 text-gray-700">{a.name}</td>
                      <td className="px-3 py-2 text-center">
                        <TierBadge tier={a.tier} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <ActionButtons a={a} mutable={mutable} blockReason={blockReason} setEditing={setEditing} setShowForm={setShowForm} confirm={confirm} toast={toast} fetchAdmins={fetchAdmins} compact />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 모바일: 카드 리스트 */}
            <div className="lg:hidden divide-y divide-gray-100">
              {admins.map(a => {
                const mutable = canMutate(a);
                const blockReason = isSuper && a.tier === 'super' ? '슈퍼관리자는 개발자만 관리 가능' : !isDev && !isSuper ? '권한 없음' : '';
                return (
                  <div key={a.id} className="p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 truncate">{a.name}</span>
                        <TierBadge tier={a.tier} />
                      </div>
                      <p className="text-xs text-gray-500 truncate">{a.loginId}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ActionButtons a={a} mutable={mutable} blockReason={blockReason} setEditing={setEditing} setShowForm={setShowForm} confirm={confirm} toast={toast} fetchAdmins={fetchAdmins} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <AdminFormModal
          editing={editing}
          isDev={isDev}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchAdmins(); }}
        />
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: AdminUser['tier'] }) {
  if (tier === 'super') {
    return <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full whitespace-nowrap">슈퍼관리자</span>;
  }
  return <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full whitespace-nowrap">관리자</span>;
}

function ActionButtons({ a, mutable, blockReason, setEditing, setShowForm, confirm, toast, fetchAdmins, compact }: {
  a: AdminUser;
  mutable: boolean;
  blockReason: string;
  setEditing: (u: AdminUser | null) => void;
  setShowForm: (b: boolean) => void;
  confirm: (msg: string, opts?: { confirmText?: string; danger?: boolean }) => Promise<boolean>;
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
  fetchAdmins: () => void;
  compact?: boolean;
}) {
  // 데스크톱(compact): 작은 아이콘만 / 모바일: 큰 터치 타겟
  const sizeClass = compact ? 'p-2 min-w-[36px] min-h-[36px]' : 'p-3 min-w-[44px] min-h-[44px]';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <>
      <button
        type="button"
        onClick={() => { setEditing(a); setShowForm(true); }}
        disabled={!mutable}
        className={`${sizeClass} hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center`}
        title={mutable ? '수정' : (blockReason || '수정 불가')}
        aria-label="수정"
      >
        <svg className={`${iconSize} text-gray-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm(`${a.name} 계정을 삭제하시겠습니까?`, { confirmText: '삭제', danger: true });
          if (!ok) return;
          const res = await apiFetch(`/api/admin-users/${a.id}`, { method: 'DELETE' });
          if (res.ok) {
            toast('삭제되었습니다.', 'success');
            fetchAdmins();
          } else {
            const body = await res.json().catch(() => ({}));
            toast(body.error || '삭제 실패', 'error');
          }
        }}
        disabled={!mutable}
        className={`${sizeClass} hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center`}
        title={mutable ? '삭제' : (blockReason || '삭제 불가')}
        aria-label="삭제"
      >
        <svg className={`${iconSize} text-gray-400 hover:text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </>
  );
}

function AdminFormModal({ editing, isDev, onClose, onSaved }: {
  editing: AdminUser | null;
  isDev: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      loginId: (fd.get('loginId') as string).trim(),
      name: (fd.get('name') as string).trim(),
      tier: fd.get('tier') as string,
    };
    const password = ((fd.get('password') as string) || '').trim();
    if (password) payload.password = password;

    try {
      const url = editing ? `/api/admin-users/${editing.id}` : '/api/admin-users';
      const method = editing ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (res.ok) {
        toast(editing ? '수정되었습니다.' : '추가되었습니다.', 'success');
        onSaved();
      } else {
        const body = await res.json().catch(() => ({}));
        toast(body.error || '저장 실패', 'error');
      }
    } catch {
      toast('네트워크 오류', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Esc 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 px-4 overscroll-contain" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fadeIn">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{editing ? '관리자 수정' : '관리자 추가'}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">로그인 ID <span className="text-red-500">*</span></span>
            <input name="loginId" defaultValue={editing?.loginId} className="input mt-1" required minLength={3} placeholder="email 형식 또는 영문 ID" autoFocus={!editing} autoComplete="off" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">이름 <span className="text-red-500">*</span></span>
            <input name="name" defaultValue={editing?.name} className="input mt-1" required placeholder="표시 이름" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              비밀번호 {editing && <span className="text-xs text-gray-400 font-normal ml-1">(빈 칸 두면 기존 유지)</span>}
              {!editing && <span className="text-red-500"> *</span>}
            </span>
            <input name="password" type="password" className="input mt-1" placeholder="4자 이상" autoComplete="new-password" required={!editing} minLength={4} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">권한</span>
            <select name="tier" defaultValue={editing?.tier === 'super' ? 'super' : 'admin'} className="input mt-1" disabled={!isDev && !!editing}>
              <option value="admin">관리자 (일반)</option>
              <option value="super" disabled={!isDev}>슈퍼관리자{!isDev && ' (개발자만 설정 가능)'}</option>
            </select>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost-lg flex-1">취소</button>
            <button type="submit" disabled={submitting} className="btn-primary-lg flex-1">
              {submitting ? '저장 중...' : editing ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
