import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MacPoll",
  description: "McMaster live classroom polling & attendance"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-mcmaster-maroon flex items-center justify-center text-white font-bold">
                  M
                </div>
                <span className="font-semibold text-lg tracking-tight">
                  MacPoll
                </span>
              </div>
              <span className="text-xs text-slate-500">
                McMaster University • Live Polling & Attendance
              </span>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
