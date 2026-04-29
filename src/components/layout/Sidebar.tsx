'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/store/authStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const canManageAdmins = user?.role === 'admin' && (user?.tier === 'dev' || user?.tier === 'super');
  const navItems = user?.role === 'store'
    ? [
        { href: '/', label: '일정 신청/조회', icon: CalendarIcon },
      ]
    : [
        { href: '/', label: '일정 관리', icon: CalendarIcon },
        { href: '/dashboard', label: '운영 현황', icon: DashboardIcon },
        { href: '/settlements', label: '정산 관리', icon: SettlementIcon },
        { href: '/stores', label: '고객 관리', icon: ShopIcon },
        { href: '/teams', label: '팀 관리', icon: StoreIcon },
        ...(canManageAdmins ? [{ href: '/admin-users', label: '관리자 계정', icon: AdminIcon }] : []),
      ];

  const roleLabel = user?.role === 'admin'
    ? (user.tier === 'dev' ? '개발자' : user.tier === 'super' ? '슈퍼관리자' : '관리자')
    : user?.role === 'team' ? '팀(기사)' : '고객(점주)';

  // ESC 로 사이드바 닫기 (모바일 키보드 사용자)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden overscroll-contain"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 lg:w-56 bg-white border-r border-gray-200
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* === Header: 로고 === */}
        <div className="flex items-center h-20 px-5 border-b border-gray-200 bg-gradient-to-br from-primary-light/40 to-white">
          <Image
            src="/logo.png"
            alt="DunoCare"
            width={500}
            height={100}
            priority
            className="h-9 w-auto object-contain"
            sizes="160px"
          />
          <button
            onClick={onClose}
            className="ml-auto lg:hidden p-2.5 rounded-lg hover:bg-white/60 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="사이드바 닫기"
          >
            <CloseIcon />
          </button>
        </div>

        {/* === 날짜/시계 카드 === */}
        <SidebarClock />

        {/* === 네비게이션 === */}
        <nav className="px-2 py-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                `}
              >
                <item.icon active={isActive} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* === 하단: 로그인 사용자 카드 === */}
        {user && (
          <div
            className="border-t border-gray-200 p-2.5"
            style={{ paddingBottom: `calc(0.625rem + env(safe-area-inset-bottom, 0px))` }}
          >
            <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <div
                className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-sm shrink-0 ring-1 ring-primary/20"
                aria-hidden
              >
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user.name}</p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                className="p-3 hover:bg-red-50 rounded-lg transition-colors shrink-0 group min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="로그아웃"
                aria-label="로그아웃"
              >
                <svg className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function SidebarClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // 다음 분 경계까지 남은 시간 후 갱신, 이후 매 분
    const ms = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, ms);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayShortStr = dayNames[now.getDay()];
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const dateStr = String(now.getDate()).padStart(2, '0');
  const yearStr = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ampm = now.getHours() < 12 ? '오전' : '오후';

  return (
    <div className="mx-3 my-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/60 border border-gray-200/70 px-3.5 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-gray-400 leading-none mb-1 tracking-wide">{yearStr}</p>
          <p className="text-base font-bold text-gray-900 leading-none tabular-nums">
            {monthStr}.{dateStr}
            <span className="ml-1 text-xs font-semibold text-gray-500">({dayShortStr})</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-medium text-gray-400 leading-none mb-1 tracking-wide">{ampm}</p>
          <p className="text-base font-bold text-primary leading-none tabular-nums">
            {hh}<span className="text-gray-400 mx-px">:</span>{mm}
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function StoreIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ShopIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function SettlementIcon({ active }: { active: boolean }) {
  // 원화 화폐 아이콘
  return (
    <svg className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4 6 4-6M7 13h10M7 16h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
