"use client";

import React from 'react';
import { usePathname } from 'next/navigation';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return (
      <div className="w-full bg-white min-h-screen flex flex-col relative">
        {children}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-[450px] bg-white min-h-screen shadow-2xl flex flex-col relative">
        {children}
      </div>
    </div>
  );
}
