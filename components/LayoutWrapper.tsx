/**
 * components/LayoutWrapper.tsx
 *
 * Root layout shell that serves two purposes:
 *
 * 1. Navigation history tracking — on every route change it writes the current
 *    path to sessionStorage ("cia:last-path") and promotes the previous
 *    "last-path" to "cia:prev-path". This lets SmartBackButton navigate to the
 *    genuinely previous page even across hard navigations where
 *    window.history.state might be absent.
 *
 * 2. Layout mode — admin routes (/admin/*) render full-width; all other routes
 *    are centred inside a max-w-[450px] card to simulate a mobile-app viewport.
 *    This keeps the UI readable on large desktop screens without a separate
 *    responsive design for the teacher-facing portal.
 */
"use client";

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') || pathname?.startsWith('/super-admin');

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const currentPath = pathname;
    const lastPath = window.sessionStorage.getItem("cia:last-path");

    if (lastPath && lastPath !== currentPath) {
      window.sessionStorage.setItem("cia:prev-path", lastPath);
    }

    window.sessionStorage.setItem("cia:last-path", currentPath);
  }, [pathname]);

  if (isAdmin) {
    return (
      <div className="w-full bg-white min-h-screen flex flex-col relative">
        {children}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center min-h-screen bg-slate-200">
      <div className="w-full max-w-[450px] min-h-screen shadow-2xl shadow-slate-300/60 flex flex-col relative">
        {children}
      </div>
    </div>
  );
}
