/**
 * app/admin/layout.tsx
 *
 * Shared layout for all /admin/* routes. Provides:
 *   1. Role guard — redirects non-admin users to / on mount. Shows a loading
 *      spinner while the role is being fetched to avoid flash-of-content.
 *   2. Responsive sidebar — collapsible nav with links to all admin sections:
 *      Dashboard, Santri, Ustadz, Assignments, Monitoring.
 *   3. Full-width layout (vs. the mobile-card layout used in teacher routes).
 *
 * Access: only users with role = "owner" or "admin" in organization_members can reach
 * these routes. All other users are silently redirected to the home page.
 */
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, ChevronLeft, BookOpen, GraduationCap, Loader2, Settings, Lightbulb, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import { useUserRole } from '@/lib/hooks/use-user-role';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useTerminology } from '@/lib/hooks/use-terminology';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, activeOrganization } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const t = useTerminology();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isAdmin = role === 'owner' || role === 'admin';

  // Redirect non-admin users away from /admin
  useEffect(() => {
    if (!roleLoading && role !== null && !isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, role, roleLoading, router]);
  
  // Show spinner while role is being fetched
  if (roleLoading || (role === null && user)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-600 w-8 h-8" />
      </div>
    );
  }

  // Render nothing while redirect fires for non-admins
  if (!isAdmin) return null;

  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/santri', label: `Kelola ${t.santri}`, icon: GraduationCap },
    { href: '/admin/ustadz', label: `Kelola ${t.ustadz}`, icon: Users },
    { href: '/admin/assignments', label: `Plotting ${t.santri}`, icon: UserPlus },
    { href: '/admin/monitoring', label: 'Monitor Laporan', icon: BookOpen },
    { href: '/admin/treatment-plans', label: 'Rencana Penanganan', icon: Lightbulb },
    { href: '/admin/settings', label: 'Pengaturan Sistem', icon: Settings },
  ];
  const mobilePrimaryItems = navItems.filter((item) => ['/admin', '/admin/santri', '/admin/ustadz', '/admin/monitoring', '/admin/settings'].includes(item.href));
  const mobileMoreItems = navItems.filter((item) => ['/admin/assignments', '/admin/treatment-plans'].includes(item.href));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40" style={{ boxShadow: "0 4px 0 0 #000" }}>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors border border-white/10"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {activeOrganization?.logoUrl && (
                <img
                  src={activeOrganization.logoUrl}
                  alt={activeOrganization.name}
                  className="w-5 h-5 rounded-md object-cover"
                />
              )}
              <h1 className="text-base font-black text-white">Admin Portal</h1>
            </div>
            <p className="text-[10px] text-brand-400 font-black uppercase tracking-wider">
              {activeOrganization?.name || "CDS Management"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher />
          <div className="text-[10px] font-black bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-slate-300">
            {user?.user_metadata?.name || 'Admin'}
          </div>
        </div>
      </header>

      {/* On mobile: column layout (tab bar on top, content below).
          On desktop: row layout (sidebar on left, content on right). */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r-2 border-slate-100 p-3 space-y-1 flex-shrink-0" style={{ boxShadow: "2px 0 0 0 #e2e8f0" }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 pt-2 pb-1">Navigasi</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all font-black text-sm ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
                style={isActive ? { boxShadow: "0 3px 0 0 var(--brand-700)" } : {}}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </aside>

        {/* Mobile bottom navigation keeps the primary destinations reachable
            without forcing seven long labels into one cramped row. */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t-2 border-slate-100"
          style={{ boxShadow: "0 -5px 18px rgba(15, 23, 42, 0.08)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="max-w-xl mx-auto grid grid-cols-6 items-stretch px-2 pt-2">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-w-0 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-brand-600" : "text-slate-400"} />
                <span className="text-[8px] font-black uppercase tracking-tight leading-tight text-center truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMoreOpen((open) => !open)}
            className={`min-w-0 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all ${isMoreOpen || mobileMoreItems.some((item) => pathname === item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:bg-slate-50'}`}
            aria-label="Buka menu lainnya"
          >
            {isMoreOpen ? <X size={19} /> : <MoreHorizontal size={19} />}
            <span className="text-[8px] font-black uppercase tracking-tight leading-tight">Lainnya</span>
          </button>
          </div>
          {isMoreOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border-2 border-slate-100 rounded-2xl p-2 shadow-[0_6px_20px_rgba(15,23,42,0.14)] animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setIsMoreOpen(false)} className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-black ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <Icon size={18} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-24 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
