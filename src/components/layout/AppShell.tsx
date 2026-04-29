'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/store/authStore';
import Sidebar from './Sidebar';
import Header from './Header';
import LoginPage from './LoginPage';

// 로그인 불필요한 공개 경로 (카카오 가입 완료 전 단계 등)
const PUBLIC_PATHS = ['/signup'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 공개 경로는 로그인 여부 무관하게 표시
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (!user) return <LoginPage />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-3 lg:p-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
