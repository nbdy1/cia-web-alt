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

import {
  Mic,
  BarChart3,
  LogOut,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Sparkles,
  Users,
  LineChart,
  MessageCircle,
  LayoutDashboard,
  UserCog,
  ClipboardList,
  HeartHandshake,
  FileText,
  Percent,
  Gem,
  Crown,
  Award,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/lib/context/auth-context";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { getTenantHost, isLocalHostname } from "@/lib/tenant";

// A bento-grid feature card: a screenshot fills the entire card (cropped via
// object-cover, never stretched) with a dark gradient scrim so the icon/title/
// description stay readable overlaid at the bottom. `imagePosition` controls
// which part of the image survives the crop — e.g. a screenshot with its most
// important UI at the bottom needs `object-bottom`, not the default `object-top`.
function BentoFeatureCard({
  image,
  imagePosition = "object-top",
  icon: Icon,
  title,
  text,
  className = "",
}: {
  image: string;
  imagePosition?: string;
  icon: typeof MessageCircle;
  title: string;
  text: string;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[1.8rem] border-2 border-slate-100 ${className}`}
    >
      <img
        src={image}
        alt={title}
        className={`absolute inset-0 w-full h-full object-cover ${imagePosition} transition-transform duration-500 group-hover:scale-[1.04]`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-100/90 via-slate-100/70 via-35% to-50% to-transparent" />
      <div className="relative z-10 h-full flex flex-col justify-end p-6">
        <div className="w-10 h-10 rounded-xl bg-black/70 backdrop-blur-sm text-brand-300 flex items-center justify-center mb-3 border border-white/10">
          <Icon size={18} />
        </div>
        <h3 className="font-black text-lg leading-snug text-brand-700">
          {title}
        </h3>
        <p className="text-sm text-black/75 font-bold leading-relaxed mt-2 max-w-[26rem]">
          {text}
        </p>
      </div>
    </div>
  );
}

function MarketingPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-slate-900 overflow-hidden">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <img
            className="w-12 h-auto"
            src="/img/landing/characterdev_logo.png"
          />
          {/* <span className="w-10 h-10 rounded-[1.1rem] bg-brand-500 text-white flex items-center justify-center font-black shadow-[0_3px_0_var(--brand-700)]">C</span> */}
          {/* <img className="w-36 h-auto" src="/img/landing/characterdev_logomark.png" /> */}

          <span className="font-black tracking-tight text-lg">
            character<span className="text-brand-600">dev</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-black text-slate-500">
          <a href="#tentang" className="hover:text-brand-700 transition-colors">
            Tentang
          </a>
          <a href="#fitur" className="hover:text-brand-700 transition-colors">
            Fitur
          </a>
          <a href="#harga" className="hover:text-brand-700 transition-colors">
            Harga
          </a>
        </nav>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-sm font-black text-slate-700 shadow-[0_3px_0_#dbe2e8] hover:border-brand-300 transition-colors"
        >
          Masuk <ArrowUpRight size={15} />
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-[1.02fr_.98fr] gap-14 items-center">
        <div>
          <p className="text-brand-700 text-xs font-black uppercase tracking-[.22em] mb-6">
            Ruang tumbuh untuk sekolah
          </p>
          <h1 className="font-black text-[clamp(2.7rem,6vw,5.5rem)] leading-[.96] tracking-[-.04em] max-w-3xl">
            Melihat manusia,{" "}
            <span className="text-brand-600">bukan sekadar nilai.</span>
          </h1>
          <p className="mt-7 text-lg sm:text-xl leading-relaxed text-slate-600 max-w-xl font-bold">
            characterdev membantu sekolah mendengar cerita peserta didik,
            membaca pertumbuhannya, dan mendampingi langkah berikutnya dengan
            lebih utuh.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="mailto:hello@characterdev.systems?subject=Permintaan%20Demo%20characterdev"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-brand-500 text-white font-black shadow-[0_4px_0_var(--brand-700)] hover:translate-y-px transition-transform"
            >
              Jadwalkan percakapan <ArrowUpRight size={17} />
            </a>
            <a
              href="#tentang"
              className="px-5 py-3.5 rounded-2xl text-slate-600 font-black hover:text-brand-700 transition-colors"
            >
              Lihat cara kerja
            </a>
          </div>
          <p className="mt-7 text-xs font-black text-slate-400">
            Untuk sekolah, pesantren, dan komunitas belajar yang ingin bertumbuh
            bersama.
          </p>
        </div>

        <div className="relative min-h-[410px] sm:min-h-[470px] flex items-center justify-center">
          <div className="absolute w-[88%] h-[82%] rounded-[3rem] bg-[#e7eee4] rotate-[-4deg]" />
          <div className="relative w-full max-w-[520px] rotate-[1.5deg]">
            <div className="bg-slate-900 rounded-[2rem] p-3 sm:p-4 shadow-[0_9px_0_#0000001a] border-2 border-slate-800">
              <div className="flex items-center gap-1.5 px-2 pb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="ml-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
                  Video perkenalan characterdev
                </span>
              </div>
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/GhJAo-JTxzo?rel=0"
                  title="Video perkenalan characterdev"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
          <div className="absolute right-0 bottom-7 sm:right-[-10px] bg-slate-900 text-white p-4 rounded-2xl shadow-[0_4px_0_#cbd5e1] rotate-[-5deg] max-w-[170px]">
            <p className="text-[10px] uppercase tracking-widest text-brand-300 font-black">
              Yang penting
            </p>
            <p className="text-sm font-black leading-snug mt-2">
              Setiap anak punya cerita yang layak didengar.
            </p>
          </div>
        </div>
      </section>

      {/* Tentang */}
      <section
        id="tentang"
        className="bg-white border-y-2 py-10 border-slate-100 relative"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 flex flex-col lg:grid lg:grid-cols-[1fr_1fr] gap-12 lg:items-start relative">
          <img
            src="/img/landing/cds_home_phone.png"
            alt="Character Development System Home"
            className="lg:w-72 rotate-72 max-lg:hidden h-auto absolute md:top-[20%] md:left-32"
          />

          <div className="relative">
            <p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">
              Tentang characterdev
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3 leading-[1.05]">
              Character Development System (CDS) untuk guru.
            </h2>
          </div>
          <div className="grid grid-flow-col max-lg:grid-cols-[1fr_1fr] gap-5 place-items-center">
            <img
              src="/img/landing/cds_home_phone.png"
              alt="Character Development System"
              className="w-48 max-lg:rotate-6 lg:hidden h-auto"
            />

            <div className="space-y-4 text-slate-600 font-bold leading-relaxed text-base sm:text-lg">
              <p>
                characterdev adalah aplikasi untuk menanamkan karakter, mental,
                dan soft skill Qurani ke dalam diri peserta didik, berdasarkan
                hasil observasi guru terhadap pikiran, perkataan, dan perbuatan
                mereka sehari-hari.
              </p>
              <p>
                Aplikasi ini membantu guru mengobservasi, menganalisis, serta
                memperoleh gambaran yang komprehensif mengenai pertumbuhan
                karakter, mental, dan soft skill peserta didik berdasarkan data
                yang terukur — sekaligus memberikan rekomendasi treatment berupa
                nasihat, pendekatan, dan strategi pembinaan yang bisa langsung
                diterapkan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fbfcf8] relative z-10 border-b-2 border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-xl mb-12">
            <p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">
              Dibuat untuk ritme sekolah
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">
              Pendampingan yang terasa dekat, data yang tetap berguna.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              [
                MessageCircle,
                "Dengar lebih dalam",
                "Percakapan terarah membantu guru menangkap konteks di balik perilaku, bukan hanya hasil akhirnya.",
              ],
              [
                LineChart,
                "Lihat pola pertumbuhan",
                "Catatan yang terkumpul menjadi gambaran perkembangan yang bisa dibaca bersama.",
              ],
              [
                Users,
                "Bergerak sebagai tim",
                "Guru, wali, dan sekolah punya bahasa yang sama untuk memilih langkah pendampingan berikutnya.",
              ],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof MessageCircle;
              return (
                <div
                  key={title as string}
                  className="p-6 rounded-[1.6rem] border-2 border-slate-100 bg-white"
                >
                  <div className="w-11 h-11 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mb-6">
                    <ItemIcon size={20} />
                  </div>
                  <h3 className="font-black text-lg">{title as string}</h3>
                  <p className="text-sm text-slate-500 font-bold leading-relaxed mt-3">
                    {text as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Fitur untuk guru / ustadz */}
      <section id="fitur" className="bg-white border-b-2 border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-xl mb-12">
            <p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">
              Sisi guru
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">
              Semua yang guru butuhkan untuk mendampingi santri.
            </h2>
            <p className="mt-4 text-slate-500 font-bold leading-relaxed">
              Dari input observasi harian sampai rapor perkembangan siap cetak —
              satu tempat, satu alur.
            </p>
          </div>
          <div>
            {/* Row 1, left → right, staggered progressively lower — a staircase.
                Stagger only applies from lg: up; on mobile/tablet it's a plain stack. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <BentoFeatureCard
                image="/img/landing/dashboard_daftar_santri.png"
                imagePosition="object-top"
                icon={LayoutDashboard}
                title="Dashboard & Daftar Santri"
                text="Lihat seluruh santri bimbingan dalam satu layar, siap dipilih untuk dinilai kapan saja."
                className="h-160 md:h-160 lg:mt-0"
              />
              <BentoFeatureCard
                image="/img/landing/input_observasi.png"
                imagePosition="object-bottom"
                icon={Mic}
                title="Input Observasi via Suara atau Teks"
                text="Ceritakan perkembangan santri secara alami — sistem merangkumnya menjadi catatan terstruktur."
                className="h-120 md:h-160 lg:mt-16"
              />
              <BentoFeatureCard
                image="/img/landing/diskusi_reflektif.png"
                imagePosition="object-top"
                icon={MessageCircle}
                title="Diskusi Reflektif dengan AI"
                text="Lanjutkan percakapan atau tanyakan strategi pendampingan untuk santri tertentu, kapan pun dibutuhkan."
                className="h-160 md:h-160 lg:mt-32"
              />
            </div>
            {/* Row 2, right → left, mirrored stagger — progressively lower toward the left,
                so the two rows read as a gentle zigzag rather than a flat grid. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              <BentoFeatureCard
                image="/img/landing/persentase_ketercapaian.png"
                imagePosition="object-top"
                icon={Percent}
                title="Persentase Ketercapaian"
                text="Progres Karakter, Mental, dan Soft Skill tiap santri terlihat jelas dari waktu ke waktu."
                className="h-120 md:h-160 lg:mt-32"
              />
              <BentoFeatureCard
                image="/img/landing/profil_rapor_cms.png"
                imagePosition="object-top"
                icon={FileText}
                title="Profil & Rapor CMS Santri"
                text="Ringkasan profil, input nilai QCB/QMB/QSB, hingga rapor yang siap dicetak per periode."
                className="h-180 md:h-160 lg:mt-16"
              />
              <BentoFeatureCard
                image="/img/landing/ringkasan_observasi.png"
                imagePosition="object-top"
                icon={Sparkles}
                title="Ringkasan Observasi & Rekomendasi Treatment"
                text="Setiap laporan disertai kondisi umum, treatment prioritas, dan detail ketercapaian per indikator."
                className="h-160 md:h-160 lg:mt-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Fitur untuk admin sekolah */}
      <section className="bg-[#fbfcf8] border-b-2 border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-xl mb-12">
            <p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">
              Sisi admin sekolah
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">
              Kendali penuh untuk pimpinan sekolah.
            </h2>
            <p className="mt-4 text-slate-500 font-bold leading-relaxed">
              Satu dashboard untuk mengelola guru, santri, dan memantau seluruh
              proses pembinaan karakter sekolah.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                image: "/img/landing/admin_overview.png",
                icon: LayoutDashboard,
                title: "Overview",
                text: "Ringkasan aktivitas characterdev sekolah secara global: jumlah guru, santri, laporan, dan cakupan ketercapaian.",
                span: "sm:col-span-2 lg:col-span-2",
                height: "h-72 sm:h-120 lg:h-[26rem]",
              },
              {
                image: "/img/landing/admin_kelola_santri.png",
                icon: Users,
                title: "Kelola Santri",
                text: "Tambah, lihat, dan tugaskan santri ke guru pembimbing dari satu tempat.",
                span: "lg:col-span-1",
                height: "h-72 sm:h-120 lg:h-[26rem]",
              },
              {
                image: "/img/landing/admin_kelola_guru.png",
                icon: UserCog,
                title: "Kelola Ustadz",
                text: "Atur daftar guru dan admin beserta hak aksesnya.",
                span: "",
                height: "h-72 sm:h-120 lg:h-120",
              },
              {
                image: "/img/landing/admin_monitor_laporan.png",
                icon: ClipboardList,
                title: "Monitor Laporan",
                text: "Pantau progres laporan tiap santri per guru pembimbing.",
                span: "",
                height: "h-72 sm:h-120 lg:h-120",
              },
              {
                image: "/img/landing/admin_rencana_penanganan.png",
                icon: HeartHandshake,
                title: "Rencana Penanganan",
                text: "Lihat seluruh rencana penanganan yang dibuat guru beserta status tindak lanjutnya.",
                span: "",
                height: "h-72 sm:h-120 lg:h-120",
              },
            ].map(({ image, icon: Icon, title, text, span, height }) => (
              <div
                key={title}
                className={`group relative overflow-hidden rounded-[1.8rem] border-2 border-slate-100 ${span} ${height}`}
              >
                <img
                  src={image}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-100/90 via-slate-100/30 to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-end p-6">
                  <div className="w-10 h-10 rounded-xl bg-black/70 backdrop-blur-sm text-brand-300 flex items-center justify-center mb-3 border border-white/10">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-black text-lg leading-snug text-brand-700">
                    {title}
                  </h3>
                  <p className="text-sm text-black/75 font-bold leading-relaxed mt-2 max-w-[26rem]">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Treatment (Tidak Menghakimi) */}
      <section
        id="treatment"
        className="bg-white border-b-2 py-10 border-slate-100 relative"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 lg:py-25 flex flex-col lg:grid lg:grid-cols-[1fr_1fr] gap-12 lg:items-start relative">
          <img
            src="/img/landing/cds_treatment_phone.png"
            alt="Character Development System Treatment"
            className="lg:w-72 -rotate-6 max-lg:hidden h-auto absolute md:top-1/2 md:left-32"
          />

          <div className="relative">
            <p className="text-brand-600 text-xs font-black uppercase tracking-[.2em]">
              Tidak menghakimi
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3 leading-[1.05]">
              Pertumbuhan bukan perlombaan.
            </h2>
          </div>
          <div className="grid grid-flow-col max-lg:grid-cols-[1fr_1fr] gap-5 place-items-center">
            <div className="space-y-4 text-slate-600 font-bold leading-relaxed text-base sm:text-lg">
              <p>
                characterdev membantu sekolah membangun kebiasaan refleksi yang
                konsisten, supaya setiap catatan menjadi undangan untuk
                mendampingi, bukan label yang menutup kemungkinan.
              </p>
              <div className="grid sm:grid-cols-1 gap-3 pt-3">
                {[
                  "Konteks sebelum kesimpulan",
                  "Bahasa yang mudah dibagikan",
                  "Jejak perkembangan dari waktu ke waktu",
                  "Langkah lanjut yang konkret",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-2 items-center text-sm text-slate-700"
                  >
                    <Check size={16} className="text-brand-600 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <img
              src="/img/landing/cds_treatment_phone.png"
              alt="Character Development System Treatment"
              className="w-48 max-lg:-rotate-6 lg:hidden h-auto"
            />
          </div>
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="bg-slate-900 relative z-10 text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="max-w-xl mb-12">
            <p className="text-brand-300 text-xs font-black uppercase tracking-[.2em]">
              Investasi pembinaan karakter santri
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">
              Pilih paket sesuai jumlah santri yang dibina.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              [
                Gem,
                "Premium",
                "Rp50.000",
                "/santri/bulan",
                "Kuota 1–100 santri termonitor",
                false,
              ],
              [
                Crown,
                "Platinum",
                "Rp30.000",
                "/santri/bulan",
                "Kuota 100–300 santri termonitor",
                true,
              ],
              [
                Award,
                "Gold",
                "Hubungi Kami",
                "",
                "Khusus monitoring lebih dari 300 santri",
                false,
              ],
            ].map(([Icon, tier, price, unit, desc, highlighted]) => {
              const ItemIcon = Icon as typeof MessageCircle;
              return (
                <div
                  key={tier as string}
                  className={`p-7 rounded-[1.8rem] flex flex-col gap-5 ${highlighted ? "bg-brand-500 text-white" : "bg-white/5 border-2 border-white/10"}`}
                >
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center ${highlighted ? "bg-white/20" : "bg-white/10 text-brand-300"}`}
                  >
                    <ItemIcon size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest opacity-70">
                      {tier as string}
                    </p>
                    <p className="text-3xl font-black mt-2 leading-none">
                      {price as string}
                    </p>
                    {(unit as string) && (
                      <p className="text-xs font-bold opacity-70 mt-1">
                        {unit as string}
                      </p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-bold leading-relaxed ${highlighted ? "text-white/90" : "text-slate-300"}`}
                  >
                    {desc as string}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-xs font-bold text-slate-400 max-w-xl">
            Semua paket mencakup akses penuh ke fitur guru dan admin — perbedaan
            hanya pada kuota santri yang termonitor.
          </p>
        </div>
      </section>

      <footer className="bg-slate-900 text-white border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
          <div>
            <p className="font-black text-lg">
              character<span className="text-brand-400">dev</span>
            </p>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Mendampingi pertumbuhan, satu cerita pada satu waktu.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-black text-brand-300 hover:text-white"
          >
            Masuk ke portal <ArrowUpRight size={15} />
          </Link>
        </div>
      </footer>
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

  if (
    !user &&
    typeof window !== "undefined" &&
    (getTenantHost(window.location.host).isApex ||
      isLocalHostname(window.location.host))
  ) {
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
        <Link
          href="/create-report"
          className="block active:translate-y-1 transition-transform"
        >
          <div
            className="w-full p-8 rounded-[2rem] flex flex-col items-center text-center gap-4 bg-brand-500 cursor-pointer select-none"
            style={{ boxShadow: "0 5px 0 0 var(--brand-700)" }}
          >
            <div className="w-20 h-20 bg-white/20 rounded-[1.4rem] flex items-center justify-center">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-brand-100 text-xs font-black uppercase tracking-widest mb-1">
                Mulai Sekarang
              </p>
              <span className="text-white text-2xl font-black leading-tight">
                Input Data {t.santri}
              </span>
            </div>
          </div>
        </Link>

        {/* Secondary Action — Students & Analytics */}
        <Link
          href="/students"
          className="block active:translate-y-1 transition-transform"
        >
          <div
            className="w-full p-7 rounded-[2rem] flex flex-col items-center text-center gap-4 bg-white border-2 border-slate-200 cursor-pointer select-none"
            style={{ boxShadow: "0 5px 0 0 #cbd5e1" }}
          >
            <div className="w-16 h-16 bg-brand-50 rounded-[1.2rem] flex items-center justify-center border-2 border-brand-100">
              <BarChart3 className="w-8 h-8 text-brand-600" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">
                Pantau & Analisis
              </p>
              <span className="text-slate-800 text-xl font-black leading-tight">
                Profil CMS {t.santri}
              </span>
            </div>
          </div>
        </Link>

        {/* Admin Portal */}
        {isAdmin && (
          <Link
            href="/admin"
            className="block active:translate-y-1 transition-transform"
          >
            <div
              className="w-full p-6 rounded-[2rem] flex flex-col items-center text-center gap-3 bg-slate-900 cursor-pointer select-none"
              style={{ boxShadow: "0 5px 0 0 #000" }}
            >
              <div className="w-14 h-14 bg-white/10 rounded-[1.1rem] flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-brand-400" />
              </div>
              <span className="text-white text-lg font-black">
                Portal Admin
              </span>
            </div>
          </Link>
        )}
      </main>
    </div>
  );
}
