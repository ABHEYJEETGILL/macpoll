import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MacPoll — McMaster live polling & attendance",
    template: "%s · MacPoll"
  },
  description:
    "Live classroom polling and attendance for McMaster University. No clickers, no paywall."
};

export const viewport: Viewport = {
  themeColor: "#7A003C",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 rounded-md">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-mcmaster-maroon font-bold text-white"
                >
                  M
                </span>
                <span className="text-lg font-semibold tracking-tight">MacPoll</span>
              </Link>
              <nav aria-label="Main" className="flex items-center gap-4 text-sm">
                <Link href="/student/join" className="rounded text-slate-600 hover:text-slate-900">
                  Join a session
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded font-medium text-mcmaster-maroon hover:underline"
                >
                  Dashboard
                </Link>
              </nav>
            </div>
          </header>

          <main id="main" className="flex-1">
            {children}
          </main>

          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
              MacPoll · McMaster University · Restricted to @mcmaster.ca accounts
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
