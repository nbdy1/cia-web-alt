"use client";

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

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
