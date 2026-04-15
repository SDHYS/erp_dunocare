import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ScheduleProvider } from "@/store/scheduleStore";
import { AuthProvider } from "@/store/authStore";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "DUNOCARE ERP",
  description: "DUNOCARE ERP - 정비/청소 일정 관리 시스템",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
            <AppShell>{children}</AppShell>
          </ScheduleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
