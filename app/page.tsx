/**
 * app/page.tsx
 *
 * Home / landing page shown after login. Role-aware navigation hub:
 *   - All users see: "Buat Laporan Santri" (→ /create-report) and
 *                    "Laporan & Analitik" (→ /students)
 *   - Admin only sees: "Portal Admin" (→ /admin)
 *
 * The user's display name is read from Supabase auth metadata (set during
 * signup). The role is fetched from the `profiles` table on mount.
 *
 * SettingsDropdown (font/size picker + glossary) lives in the top-right corner
 * and is available from this page on every session.
 */
"use client";

import { Mic, BarChart3, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/lib/context/auth-context";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useUserRole } from "@/lib/hooks/use-user-role";

export default function HomePage() {
  const { user, signOut, activeOrganization } = useAuth();
  const { role } = useUserRole();
  const isAdmin = role === "owner" || role === "admin";
  const userName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Ustaz Abdullah";
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-paper">
      {/* Top Bar */}
      <header className="flex justify-between items-center gap-1 px-6 pt-10 pb-2">
        <div className="flex items-center gap-2">
          {activeOrganization?.logoUrl && (
            <img
              src={activeOrganization.logoUrl}
              alt={activeOrganization.name}
              className="w-9 h-9 rounded-2xl object-cover"
            />
          )}
          <span className="text-brand-700 font-black text-sm tracking-tight">
            {activeOrganization?.name || "CIA"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SettingsDropdown />
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-rose-500 bg-white border-2 border-rose-100 rounded-2xl hover:bg-rose-50 active:translate-y-px transition-all"
            style={{ boxShadow: "0 3px 0 0 #fecaca" }}
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Keluar dari akun?"
        description="Anda perlu masuk kembali untuk mengakses aplikasi."
        confirmLabel="Keluar"
        cancelLabel="Batal"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <main className="flex-1 px-6 pt-8 pb-10 flex flex-col gap-8 animate-fade-in">
        {/* Welcome */}
        <section>
          <p className="text-brand-600 font-black text-sm uppercase tracking-widest mb-1">
            Assalamualaikum 👋
          </p>
          <h1 className="text-4xl font-black text-slate-800 leading-tight">
            {userName}
          </h1>
        </section>

        {/* Primary Action — Create Report */}
        <Link href="/create-report" className="block active:translate-y-1 transition-transform">
          <div
            className="w-full p-8 rounded-[2rem] flex flex-col items-center text-center gap-4 bg-brand-500 cursor-pointer select-none"
            style={{ boxShadow: "0 5px 0 0 var(--brand-700)" }}
          >
            <div className="w-20 h-20 bg-white/20 rounded-[1.4rem] flex items-center justify-center">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-brand-100 text-xs font-black uppercase tracking-widest mb-1">Mulai Sekarang</p>
              <span className="text-white text-2xl font-black leading-tight">
                Input Data Santri
              </span>
            </div>
          </div>
        </Link>

        {/* Secondary Action — Students & Analytics */}
        <Link href="/students" className="block active:translate-y-1 transition-transform">
          <div
            className="w-full p-7 rounded-[2rem] flex flex-col items-center text-center gap-4 bg-white border-2 border-slate-200 cursor-pointer select-none"
            style={{ boxShadow: "0 5px 0 0 #cbd5e1" }}
          >
            <div className="w-16 h-16 bg-brand-50 rounded-[1.2rem] flex items-center justify-center border-2 border-brand-100">
              <BarChart3 className="w-8 h-8 text-brand-600" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Pantau & Analisis</p>
              <span className="text-slate-800 text-xl font-black leading-tight">
                Profil CMS Santri
              </span>
            </div>
          </div>
        </Link>

        {/* Admin Portal */}
        {isAdmin && (
          <Link href="/admin" className="block active:translate-y-1 transition-transform">
            <div
              className="w-full p-6 rounded-[2rem] flex flex-col items-center text-center gap-3 bg-slate-900 cursor-pointer select-none"
              style={{ boxShadow: "0 5px 0 0 #000" }}
            >
              <div className="w-14 h-14 bg-white/10 rounded-[1.1rem] flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-brand-400" />
              </div>
              <span className="text-white text-lg font-black">Portal Admin</span>
            </div>
          </Link>
        )}
      </main>
    </div>
  );
}
