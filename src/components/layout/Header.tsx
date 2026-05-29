'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/': '일정 관리',
  '/stores': '고객 관리',
  '/teams': '팀 관리',
  '/dashboard': '운영 현황',
  '/settlements': '정산 관리',
};

interface HeaderProps {
  onMenuClick: () => void;
}

// 모바일에서만 햄버거 메뉴 + 페이지 타이틀 표시 (데스크톱에서는 헤더 숨김)
export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || '두노케어 스케줄러';
  return (
    <header className="h-14 lg:hidden bg-white border-b border-gray-200 flex items-center px-2 gap-2 sticky top-0 z-30">
      <button
        type="button"
        onClick={onMenuClick}
        className="p-3 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="메뉴 열기"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
    </header>
  );
}
