import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ScheduleProvider } from "@/store/scheduleStore";
import { AuthProvider } from "@/store/authStore";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "일정관리 어드민",
  description: "정비/청소 일정 관리 시스템",
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
        <ScheduleProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ScheduleProvider>
      </body>
    </html>
  );
}
