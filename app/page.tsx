"use client";

import { Mic, BarChart3, LogOut } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/context/auth-context";
import { SettingsDropdown } from "@/components/SettingsDropdown";

export default function HomePage() {
  const { user, signOut } = useAuth();
  const userName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Ustaz Abdullah";

  return (
    <>
      {/* Top Bar */}
      <header className="flex justify-between items-center px-6 pt-10 pb-4">
        <div className="text-emerald-700 font-extrabold text-2xl tracking-tighter">
          CIA.
        </div>
        <div className="flex items-center gap-2">
          <SettingsDropdown />
          <button
            onClick={signOut}
            className="p-2 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-full transition-colors flex items-center gap-1.5 px-3 border border-slate-100 hover:border-rose-100 text-xs font-semibold shadow-sm"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pt-6">
        {/* Welcome Section */}
        <section className="mb-10">
          <p className="text-slate-400 text-lg font-serif italic">
            Assalamualaikum,
          </p>
          <h1 className="text-4xl font-bold text-slate-800 leading-tight">
            {userName}
          </h1>
        </section>

        {/* Action Buttons Stack */}
        <div className="flex flex-col gap-6">
          {/* Create Student Report - Primary Action */}
          <Link href="/create-report">
            <button className="group relative w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-lg shadow-emerald-200">
              <div className="bg-white/20 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <span className="text-white text-2xl font-bold font-serif">
                Buat Laporan Santri
              </span>
            </button>
          </Link>

          <Link href="/students">
            <button className="group w-full bg-slate-50 border-2 border-slate-100 hover:border-emerald-200 active:scale-[0.98] transition-all p-8 rounded-[2.5rem] flex flex-col items-center text-center">
              <div className="bg-white p-4 rounded-2xl mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <BarChart3 className="w-8 h-8 text-slate-600" />
              </div>
              <span className="text-slate-800 text-2xl font-bold font-serif">
                Laporan Santri & Analitik
              </span>
            </button>
          </Link>

          <Link href="/admin">
            <button className="group w-full bg-slate-900 border-2 border-slate-800 hover:border-slate-700 active:scale-[0.98] transition-all p-6 rounded-[2.5rem] flex flex-col items-center text-center mt-2">
              <div className="bg-slate-800 p-3 rounded-2xl mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-300">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
                </svg>
              </div>
              <span className="text-slate-300 text-lg font-bold font-serif">
                Portal Admin
              </span>
            </button>
          </Link>
        </div>
      </main>
    </>
  );
}
