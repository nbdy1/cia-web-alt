"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, ChevronLeft, BookOpen, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/santri', label: 'Kelola Santri', icon: GraduationCap },
    { href: '/admin/ustadz', label: 'Kelola Ustadz', icon: Users },
    { href: '/admin/assignments', label: 'Plotting Santri', icon: UserPlus },
    { href: '/admin/monitoring', label: 'Monitor Laporan', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
            <p className="text-xs text-emerald-400 font-medium">CIA Management Portal</p>
          </div>
        </div>
        <div className="text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
          Admin: {user?.user_metadata?.name || user?.email || 'Admin'}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Tabs (Mobile bottom, Desktop side but here we use a simple top tab row for mobile-friendly responsive) */}
        <div className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2">Menu Navigasi</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                  isActive 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={18} className={isActive ? "text-emerald-600" : "text-slate-400"} />
                {item.label}
              </Link>
            )
          })}
        </div>
        
        {/* Mobile Tab Nav */}
        <div className="md:hidden flex bg-white border-b border-slate-100 w-full overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 min-w-[100px] transition-all border-b-2 ${
                  isActive 
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/30' 
                  : 'border-transparent text-slate-500'
                }`}
              >
                <Icon size={18} className={isActive ? "text-emerald-600" : "text-slate-400"} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            )
          })}
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
