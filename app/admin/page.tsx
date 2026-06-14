/**
 * app/admin/page.tsx
 *
 * Main admin dashboard — a bird's-eye view of the pesantren's assessment
 * activity. Fetches data from Supabase on mount and renders 7 widgets:
 *
 *   1. Quick stats     – total students, recent reports, low-scoring students
 *   2. Activity heatmap – daily report counts for the last 30 days
 *   3. Ustadz performance – table ranking ustadz by report count
 *   4. Recent reports  – last 10 reports with student name + date
 *   5. Category fulfilment – average Karakter / Mental / Soft Skill % across
 *                            all reports (parsed from treatment_plan JSONB)
 *   6. Low-performing students – students with the lowest average fulfillment
 *   7. Assessment progress – per-student report count progress bars
 *
 * All data fetching is done inline via Supabase JS in useEffect hooks.
 * Types DayBucket and UstadzRow are defined at the top of the file.
 */
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  BookOpen,
  FileText,
  TrendingUp,
  GraduationCap,
  Heart,
  Brain,
  Zap,
  Loader2,
  Calendar,
  Award,
} from "lucide-react";
import Link from "next/link";

// ─── types ────────────────────────────────────────────────────────────────────
type DayBucket = { label: string; count: number };
type UstadzRow = { id: string; name: string; reportCount: number; studentCount: number };
type RecentReport = { id: string; studentName: string; date: string; themesCount: number; siCount: number };
type CategoryStat = { label: string; fulfilled: number; total: number; color: string; shadow: string };

// ─── helpers ──────────────────────────────────────────────────────────────────
function parsePlan(raw: any) {
  if (!raw) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return raw;
}

function buildWeekBuckets(reports: { created_at: string }[]): DayBucket[] {
  const days: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("id-ID", { weekday: "short" });
    const count = reports.filter((r) => r.created_at.slice(0, 10) === key).length;
    days.push({ label, count });
  }
  return days;
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data }: { data: DayBucket[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const H = 80;
  const BAR_W = 28;
  const GAP = 8;
  const W = data.length * (BAR_W + GAP) - GAP;

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ maxHeight: 110 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * H, d.count > 0 ? 6 : 2);
        const x = i * (BAR_W + GAP);
        const y = H - barH;
        const isToday = i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={BAR_W} height={barH}
              rx={6}
              fill={isToday ? "#22c55e" : "#e2e8f0"}
            />
            {d.count > 0 && (
              <text
                x={x + BAR_W / 2} y={y - 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight="900"
                fill={isToday ? "#15803d" : "#94a3b8"}
              >
                {d.count}
              </text>
            )}
            <text
              x={x + BAR_W / 2} y={H + 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight="700"
              fill={isToday ? "#15803d" : "#94a3b8"}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ustadz: 0, santri: 0, reports: 0, activeSantri: 0 });
  const [weekData, setWeekData] = useState<DayBucket[]>([]);
  const [catStats, setCatStats] = useState<CategoryStat[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [ustadzBoard, setUstadzBoard] = useState<UstadzRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        // ── 1. Counts ───────────────────────────────────────────────────────
        const [
          { count: ustadzCount },
          { count: santriCount },
          { data: reportsRaw },
          { data: studentsRaw },
          { data: ustadzRaw },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "ustadz"),
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("reports").select("id, created_at, student_id, treatment_plan, students(name)").order("created_at", { ascending: false }).limit(50),
          supabase.from("students").select("id, assigned_ustadz_id, reports(id)"),
          supabase.from("profiles").select("id, name").eq("role", "ustadz"),
        ]);

        const allReports = reportsRaw ?? [];

        // ── 2. Stats ────────────────────────────────────────────────────────
        const activeSantriIds = new Set(allReports.map((r: any) => r.student_id));
        setStats({
          ustadz: ustadzCount ?? 0,
          santri: santriCount ?? 0,
          reports: allReports.length,
          activeSantri: activeSantriIds.size,
        });

        // ── 3. Week chart ───────────────────────────────────────────────────
        setWeekData(buildWeekBuckets(allReports));

        // ── 4. Category stats (aggregate fulfilled sub-indicators) ─────────
        const catMap: Record<string, { fulfilled: number; total: number }> = {
          Karakter: { fulfilled: 0, total: 0 },
          Mental: { fulfilled: 0, total: 0 },
          "Soft Skill": { fulfilled: 0, total: 0 },
        };
        allReports.forEach((r: any) => {
          const plan = parsePlan(r.treatment_plan);
          const assessments: any[] = plan?.detailed_assessments ?? [];
          assessments.forEach((a: any) => {
            const cat = a?.category as string;
            if (!catMap[cat]) return;
            const fulfilled = Array.isArray(a.fulfilled_sub_indicators) ? a.fulfilled_sub_indicators.length : 0;
            const missing = Array.isArray(a.missing_sub_indicators) ? a.missing_sub_indicators.length : 0;
            catMap[cat].fulfilled += fulfilled;
            catMap[cat].total += fulfilled + missing;
          });
        });
        setCatStats([
          { label: "Karakter",   ...catMap["Karakter"],   color: "#f43f5e", shadow: "#9f1239" },
          { label: "Mental",     ...catMap["Mental"],     color: "#3b82f6", shadow: "#1d4ed8" },
          { label: "Soft Skill", ...catMap["Soft Skill"], color: "#a855f7", shadow: "#7e22ce" },
        ]);

        // ── 5. Recent reports ───────────────────────────────────────────────
        setRecentReports(
          allReports.slice(0, 6).map((r: any) => {
            const plan = parsePlan(r.treatment_plan);
            const assessments: any[] = plan?.detailed_assessments ?? [];
            const themes = new Set(assessments.map((a: any) => String(a?.theme ?? "").trim().toLowerCase()).filter(Boolean)).size;
            const si = assessments.reduce((acc: number, a: any) => acc + (Array.isArray(a.fulfilled_sub_indicators) ? a.fulfilled_sub_indicators.length : 0), 0);
            return {
              id: r.id,
              studentName: (r.students as any)?.name ?? "—",
              date: new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
              themesCount: themes,
              siCount: si,
            };
          })
        );

        // ── 6. Ustadz leaderboard ───────────────────────────────────────────
        const studentsByUstadz: Record<string, { students: Set<string>; reports: number }> = {};
        (studentsRaw ?? []).forEach((s: any) => {
          const uid = s.assigned_ustadz_id;
          if (!uid) return;
          if (!studentsByUstadz[uid]) studentsByUstadz[uid] = { students: new Set(), reports: 0 };
          studentsByUstadz[uid].students.add(s.id);
          studentsByUstadz[uid].reports += (s.reports ?? []).length;
        });
        setUstadzBoard(
          (ustadzRaw ?? [])
            .map((u: any) => ({
              id: u.id,
              name: u.name,
              reportCount: studentsByUstadz[u.id]?.reports ?? 0,
              studentCount: studentsByUstadz[u.id]?.students.size ?? 0,
            }))
            .sort((a, b) => b.reportCount - a.reportCount)
        );
      } catch (err) {
        console.error("Admin overview error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Memuat…</span>
      </div>
    );
  }

  const totalWeek = weekData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-black text-slate-800">Overview</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">Ringkasan aktivitas CIA secara global</p>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ustadz", value: stats.ustadz, icon: Users, bg: "#f0fdf4", icon_color: "#22c55e", shadow: "#a7f3d0" },
          { label: "Santri", value: stats.santri, icon: GraduationCap, bg: "#eff6ff", icon_color: "#3b82f6", shadow: "#bfdbfe" },
          { label: "Total Laporan", value: stats.reports, icon: FileText, bg: "#faf5ff", icon_color: "#a855f7", shadow: "#e9d5ff" },
          { label: "Santri Aktif", value: stats.activeSantri, icon: TrendingUp, bg: "#fffbeb", icon_color: "#f59e0b", shadow: "#fde68a" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100"
              style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: s.bg, boxShadow: `0 3px 0 0 ${s.shadow}` }}
              >
                <Icon size={18} style={{ color: s.icon_color }} />
              </div>
              <p className="text-3xl font-black text-slate-800">{s.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Activity chart + Category stats ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Bar chart */}
        <div className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-black text-slate-800">Aktivitas Minggu Ini</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Laporan dibuat per hari</p>
            </div>
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-black text-emerald-700 bg-emerald-50"
              style={{ boxShadow: "0 2px 0 0 #a7f3d0" }}
            >
              {totalWeek} total
            </div>
          </div>
          <BarChart data={weekData} />
        </div>

        {/* Category coverage */}
        <div className="bg-white rounded-[1.5rem] p-5 border-2 border-slate-100" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <div className="mb-4">
            <p className="font-black text-slate-800">Cakupan Ketercapaian</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Sub-indikator terpenuhi dari semua laporan</p>
          </div>
          <div className="space-y-4">
            {catStats.map((c) => {
              const pct = c.total > 0 ? Math.round((c.fulfilled / c.total) * 100) : 0;
              const CatIcon = c.label === "Karakter" ? Heart : c.label === "Mental" ? Brain : Zap;
              return (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <CatIcon size={13} style={{ color: c.color }} />
                      <span className="text-xs font-black text-slate-700">{c.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400">{c.fulfilled}/{c.total}</span>
                      <span className="text-xs font-black" style={{ color: c.color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: c.color }}
                    />
                  </div>
                </div>
              );
            })}
            {catStats.every((c) => c.total === 0) && (
              <p className="text-xs text-slate-400 font-bold text-center py-4">Belum ada data laporan</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent reports + Ustadz leaderboard ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Recent reports */}
        <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <p className="font-black text-slate-800">Laporan Terbaru</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">6 laporan terakhir</p>
            </div>
            <Link href="/admin/monitoring" className="text-[10px] font-black text-emerald-600 uppercase tracking-wider hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y-2 divide-slate-50">
            {recentReports.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-300">
                <BookOpen className="w-7 h-7 mx-auto mb-2" />
                <p className="text-xs font-black">Belum ada laporan</p>
              </div>
            ) : (
              recentReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/reports/${r.id}?from=${encodeURIComponent("/admin/monitoring")}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-700 text-sm flex-shrink-0">
                      {r.studentName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm leading-tight">{r.studentName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar size={9} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400">{r.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">{r.themesCount}T</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black">{r.siCount}SI</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Ustadz leaderboard */}
        <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <p className="font-black text-slate-800">Aktivitas Ustadz</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Diurutkan berdasarkan laporan</p>
            </div>
            <Award size={16} className="text-amber-400" />
          </div>
          <div className="divide-y-2 divide-slate-50">
            {ustadzBoard.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-300">
                <Users className="w-7 h-7 mx-auto mb-2" />
                <p className="text-xs font-black">Belum ada Ustadz</p>
              </div>
            ) : (
              ustadzBoard.map((u, i) => {
                const medalColors = ["#f59e0b", "#94a3b8", "#b45309"];
                const topThree = i < 3;
                return (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={topThree
                          ? { background: medalColors[i] + "22", color: medalColors[i], boxShadow: `0 2px 0 0 ${medalColors[i]}55` }
                          : { background: "#f1f5f9", color: "#94a3b8" }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm leading-tight">{u.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{u.studentCount} santri</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-800 text-sm">{u.reportCount}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">laporan</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
