"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Server, ChevronLeft, Loader2, BarChart3 } from 'lucide-react';
import { useIsPlatformAdmin } from '@/lib/hooks/use-platform-admin';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Gate on membership of public.platform_admins — the SAME check the
  // super-admin server actions enforce, so page and actions never disagree.
  const { isPlatformAdmin, loading: adminLoading } = useIsPlatformAdmin();

  useEffect(() => {
    if (!adminLoading && !isPlatformAdmin) {
      router.replace('/');
    }
  }, [isPlatformAdmin, adminLoading, router]);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
      </div>
    );
  }

  if (!isPlatformAdmin) return null;

  const navItems = [
    { href: '/super-admin', label: 'Organizations', icon: Building2 },
    { href: '/super-admin/usage', label: 'Usage & Billing', icon: BarChart3 },
    { href: '/super-admin/system', label: 'System Metrics', icon: Server },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40" style={{ boxShadow: "0 4px 0 0 #000" }}>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-rose-400">Super Admin</h1>
            </div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Global System Management</p>
          </div>
        </div>
        <div className="text-[10px] font-black bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-300">
          Super Admin Mode
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-56 bg-white border-r-2 border-slate-100 p-3 space-y-1 flex-shrink-0" style={{ boxShadow: "2px 0 0 0 #e2e8f0" }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 pt-2 pb-1">Navigasi Global</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all font-black text-sm ${
                  isActive
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                style={isActive ? { boxShadow: "0 3px 0 0 #e11d48" } : {}}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </aside>

        <nav
          className="md:hidden flex shrink-0 bg-white border-b-2 border-slate-100 overflow-x-auto"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-2 min-w-[60px] transition-all border-b-2 ${
                  isActive
                    ? 'border-rose-500 text-rose-600'
                    : 'border-transparent text-slate-400'
                }`}
              >
                <Icon size={15} className={isActive ? "text-rose-600" : "text-slate-400"} />
                <span className="text-[8px] font-black uppercase tracking-tight leading-tight text-center whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
