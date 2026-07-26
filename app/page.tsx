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

import { Mic, BarChart3, LogOut, ShieldCheck, ArrowUpRight, Check, Sparkles, Users, LineChart, MessageCircle } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/lib/context/auth-context";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { getTenantHost, isLocalHostname } from "@/lib/tenant";

function MarketingPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-slate-900 overflow-hidden">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-[1.1rem] bg-brand-500 text-white flex items-center justify-center font-black shadow-[0_3px_0_var(--brand-700)]">C</span>
          <span className="font-black tracking-tight text-lg">character<span className="text-brand-600">dev</span></span>
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-sm font-black text-slate-700 shadow-[0_3px_0_#dbe2e8] hover:border-brand-300 transition-colors">
          Masuk <ArrowUpRight size={15} />
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-[1.02fr_.98fr] gap-14 items-center">
        <div>
          <p className="text-brand-700 text-xs font-black uppercase tracking-[.22em] mb-6">Ruang tumbuh untuk sekolah</p>
          <h1 className="font-black text-[clamp(2.7rem,6vw,5.5rem)] leading-[.96] tracking-[-.04em] max-w-3xl">
            Melihat manusia, <span className="text-brand-600">bukan sekadar nilai.</span>
          </h1>
          <p className="mt-7 text-lg sm:text-xl leading-relaxed text-slate-600 max-w-xl font-bold">
            characterdev membantu sekolah mendengar cerita peserta didik, membaca pertumbuhannya, dan mendampingi langkah berikutnya dengan lebih utuh.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="mailto:hello@characterdev.systems?subject=Permintaan%20Demo%20characterdev" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-brand-500 text-white font-black shadow-[0_4px_0_var(--brand-700)] hover:translate-y-px transition-transform">
              Jadwalkan percakapan <ArrowUpRight size={17} />
            </a>
            <a href="#cara-kerja" className="px-5 py-3.5 rounded-2xl text-slate-600 font-black hover:text-brand-700 transition-colors">Lihat cara kerja</a>
          </div>
          <p className="mt-7 text-xs font-black text-slate-400">Untuk sekolah, pesantren, dan komunitas belajar yang ingin bertumbuh bersama.</p>
        </div>

        <div className="relative min-h-[410px] sm:min-h-[470px] flex items-center justify-center">
          <div className="absolute w-[88%] h-[82%] rounded-[3rem] bg-[#e7eee4] rotate-[-4deg]" />
          <div className="relative w-full max-w-[470px] bg-white border-2 border-slate-200 rounded-[2.6rem] p-6 sm:p-8 shadow-[0_7px_0_#d8e0df] rotate-[2deg]">
            <div className="flex items-center justify-between mb-8">
              <div><p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Peta pertumbuhan</p><p className="font-black text-xl mt-1">Alya Rahma</p></div>
              <div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-black">AR</div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-7">
              {[['Karakter','72%','bg-rose-500'],['Mental','64%','bg-sky-500'],['Soft Skill','81%','bg-purple-400']].map(([label, value, color]) => <div key={label} className="p-3 rounded-2xl bg-slate-50"><p className="text-[10px] font-black text-slate-400">{label}</p><p className="text-xl font-black mt-2">{value}</p><div className="h-1.5 bg-slate-200 rounded-full mt-2"><div className={`h-full rounded-full ${color}`} style={{width:value}} /></div></div>)}
            </div>
            <div className="border-t-2 border-slate-100 pt-5 space-y-4">
              <div className="flex gap-3"><span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><MessageCircle size={15}/></span><div><p className="text-xs font-black">Catatan percakapan</p><p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">Mulai berani menyampaikan pendapat saat diskusi kelompok.</p></div></div>
              <div className="flex gap-3"><span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Sparkles size={15}/></span><div><p className="text-xs font-black">Langkah berikutnya</p><p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">Berikan ruang untuk memimpin refleksi mingguan.</p></div></div>
            </div>
          </div>
          <div className="absolute right-0 bottom-7 sm:right-[-10px] bg-slate-900 text-white p-4 rounded-2xl shadow-[0_4px_0_#cbd5e1] rotate-[-5deg] max-w-[170px]"><p className="text-[10px] uppercase tracking-widest text-brand-300 font-black">Yang penting</p><p className="text-sm font-black leading-snug mt-2">Setiap anak punya cerita yang layak didengar.</p></div>
        </div>
      </section>

      <section id="cara-kerja" className="bg-white border-y-2 border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-xl mb-12"><p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">Dibuat untuk ritme sekolah</p><h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Pendampingan yang terasa dekat, data yang tetap berguna.</h2></div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              [MessageCircle, 'Dengar lebih dalam', 'Percakapan terarah membantu guru menangkap konteks di balik perilaku, bukan hanya hasil akhirnya.'],
              [LineChart, 'Lihat pola pertumbuhan', 'Catatan yang terkumpul menjadi gambaran perkembangan yang bisa dibaca bersama.'],
              [Users, 'Bergerak sebagai tim', 'Guru, wali, dan sekolah punya bahasa yang sama untuk memilih langkah pendampingan berikutnya.'],
            ].map(([Icon, title, text]) => { const ItemIcon = Icon as typeof MessageCircle; return <div key={title as string} className="p-6 rounded-[1.6rem] border-2 border-slate-100 bg-[#fbfcf8]"><div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-6"><ItemIcon size={20}/></div><h3 className="font-black text-lg">{title as string}</h3><p className="text-sm text-slate-500 font-bold leading-relaxed mt-3">{text as string}</p></div> })}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-[.9fr_1.1fr] gap-12 items-start">
        <div><p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">Tidak menghakimi</p><h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Pertumbuhan bukan perlombaan.</h2></div>
        <div className="space-y-4 text-slate-600 font-bold leading-relaxed"><p>characterdev membantu sekolah membangun kebiasaan refleksi yang konsisten, supaya setiap catatan menjadi undangan untuk mendampingi, bukan label yang menutup kemungkinan.</p><div className="grid sm:grid-cols-2 gap-3 pt-3">{['Konteks sebelum kesimpulan','Bahasa yang mudah dibagikan','Jejak perkembangan dari waktu ke waktu','Langkah lanjut yang konkret'].map((item)=><div key={item} className="flex gap-2 items-center text-sm text-slate-700"><Check size={16} className="text-brand-600 shrink-0" />{item}</div>)}</div></div>
      </section>

      <footer className="bg-slate-900 text-white"><div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"><div><p className="font-black text-lg">character<span className="text-brand-400">dev</span></p><p className="text-xs text-slate-400 font-bold mt-1">Mendampingi pertumbuhan, satu cerita pada satu waktu.</p></div><Link href="/login" className="inline-flex items-center gap-2 text-sm font-black text-brand-300 hover:text-white">Masuk ke portal <ArrowUpRight size={15}/></Link></div></footer>
    </main>
  );
}

export default function HomePage() {
  const { user, signOut, activeOrganization } = useAuth();
  const { role } = useUserRole();
  const t = useTerminology();
  const isAdmin = role === "owner" || role === "admin";
  const userName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Ustaz Abdullah";
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  if (!user && typeof window !== "undefined" && (
    getTenantHost(window.location.host).isApex || isLocalHostname(window.location.host)
  )) {
    return <MarketingPage />;
  }

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
            {activeOrganization?.name || "CDS"}
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
                Input Data {t.santri}
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
                Profil CMS {t.santri}
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
