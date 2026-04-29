import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ScheduleProvider } from "@/store/scheduleStore";
import { AuthProvider } from "@/store/authStore";
import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "두노케어 스케줄러",
  description: "두노케어 스케줄러 - 정비/청소 일정 관리 시스템",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale 미설정 — 어르신 사용성 / WCAG 1.4.4 준수 (핀치줌 허용)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full antialiased">
        <AuthProvider>
          <ScheduleProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </ScheduleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
