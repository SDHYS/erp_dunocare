'use client';

const PAGE_TITLES: Record<string, string> = {
  '/': '대시보드',
  '/schedules': '일정 관리',
  '/stores': '팀 관리',
  '/settlements': '정산',
};

import { usePathname } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || '일정관리 어드민';
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = dayNames[today.getDay()];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="text-sm text-gray-500">
        {dateStr} ({dayStr})
      </div>
    </header>
  );
}
