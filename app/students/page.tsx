/**
 * app/students/page.tsx
 *
 * Student list page — the main portal for ustadz to browse and access their
 * students' assessment history.
 *
 * Features:
 *   - Paginated list (10 per page) with prev/next controls
 *   - Text search (client-side filter on student name)
 *   - Role-based filtering: admin sees all students; ustadz sees only students
 *     where assigned_ustadz_id matches their own user ID
 *   - Status badges: recap availability indicator, report count
 *   - Click any student to navigate to /students/[id]
 *
 * Data is fetched once on mount from Supabase, with the full `reports` and
 * `recap_data` joined in a single query. All filtering and pagination happen
 * client-side for snappy UX.
 */
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp,
  Users,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import Link from "next/link";

type StudentWithStats = {
  id: string;
  name: string;
  batch: string | null;
  assigned_ustadz_id: string | null;
  reportsCount: number;
  themesExplored: number;
  fulfilledSubIndicators: number;
};

type RecentReport = {
  id: string;
  title: string | null;
  created_at: string;
  students: { name: string } | null;
  treatment_plan: any;
};

export default function StudentsAnalyticsPage() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (roleLoading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      const isAdmin = role === "admin";
      const ustadzId = isAdmin ? null : user.id;

      // ── 1. Fetch students (with optional ustadz filter) ──────────────────
      let studentsQuery = supabase.from("students").select(`
        id, name, batch, assigned_ustadz_id,
        reports (
          id,
          treatment_plan
        )
      `).or('is_removed.is.null,is_removed.eq.false');
      if (ustadzId) {
        studentsQuery = studentsQuery.eq("assigned_ustadz_id", ustadzId);
      }
      const { data: studentsRaw } = await studentsQuery.order("name", { ascending: true });

      const studentIds = studentsRaw?.map((s) => s.id) ?? [];

      const parsePlan = (planRaw: any) => {
        if (!planRaw) return null;
        if (typeof planRaw === "string") {
          try {
            return JSON.parse(planRaw);
          } catch {
            return null;
          }
        }
        return planRaw;
      };

      const processed: StudentWithStats[] = (studentsRaw ?? []).map((student) => {
        const themeSet = new Set<string>();
        let fulfilledSubIndicators = 0;
        const reports = student.reports ?? [];

        reports.forEach((r: any) => {
          const plan = parsePlan(r.treatment_plan);
          const assessments = Array.isArray(plan?.detailed_assessments)
            ? plan.detailed_assessments
            : [];
          assessments.forEach((a: any) => {
            if (a?.theme) themeSet.add(String(a.theme).trim().toLowerCase());
            fulfilledSubIndicators += Array.isArray(a?.fulfilled_sub_indicators)
              ? a.fulfilled_sub_indicators.length
              : 0;
          });
        });

        return {
          id: student.id,
          name: student.name,
          batch: student.batch,
          assigned_ustadz_id: student.assigned_ustadz_id,
          reportsCount: reports.length,
          themesExplored: themeSet.size,
          fulfilledSubIndicators,
        };
      });
      setStudents(processed);

      // ── 2. Recent reports (filtered by student IDs) ───────────────────────
      if (!isAdmin && studentIds.length === 0) {
        setRecentReports([]);
        setDataLoading(false);
        return;
      }
      let recentQuery = supabase
        .from("reports")
        .select(`
          id,
          title,
          created_at,
          students (name),
          treatment_plan
        `)
        .order("created_at", { ascending: false })
        .limit(8);

      if (!isAdmin && studentIds.length > 0) {
        recentQuery = recentQuery.in("student_id", studentIds);
      }

      const { data: recentRaw } = await recentQuery;
      setRecentReports((recentRaw ?? []) as any);

      setDataLoading(false);
    };

    fetchData();
  }, [user, role, roleLoading]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (roleLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center animate-bounce-in" style={{ boxShadow: "0 4px 0 0 #a7f3d0" }}>
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        </div>
        <p className="text-emerald-600 text-xs font-black uppercase tracking-widest">Memuat data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24 font-sans">
      {/* Header */}
      <header className="px-6 pt-12 pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-6 group"
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500" style={{ boxShadow: "0 3px 0 0 #e2e8f0", minWidth: 32 }}>
            <ChevronLeft size={16} />
          </div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">
            Beranda
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-emerald-500 rounded-[1.2rem] flex items-center justify-center" style={{ boxShadow: "0 4px 0 0 #15803d" }}>
            <LayoutDashboard size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 leading-none">Santri</h1>
            <p className="text-emerald-600 text-xs font-black uppercase tracking-widest mt-0.5">Analitik & Histori</p>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {/* 1. STUDENT DIRECTORY */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <Users size={10} /> {students.length} Santri
            </div>
          </div>
          {students.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-black text-slate-400">Belum ada santri</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {students.map((student, i) => {
                const avatarColors = [
                  { bg: "#22c55e", shadow: "#15803d" },
                  { bg: "#3b82f6", shadow: "#1d4ed8" },
                  { bg: "#f59e0b", shadow: "#92400e" },
                  { bg: "#8b5cf6", shadow: "#6d28d9" },
                  { bg: "#ef4444", shadow: "#b91c1c" },
                ];
                const color = avatarColors[i % avatarColors.length];
                return (
                  <Link
                    key={student.id}
                    href={`/students/${student.id}?from=${encodeURIComponent("/students")}`}
                    className="card-3d-link block"
                  >
                    <div className="card-3d p-5">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white"
                            style={{ background: color.bg, boxShadow: `0 3px 0 0 ${color.shadow}` }}
                          >
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-lg leading-tight">
                              {student.name}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {student.batch || "Reguler"}
                            </p>
                          </div>
                        </div>
                        <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 bg-emerald-50 rounded-xl py-2 px-3 text-center border border-emerald-100">
                          <p className="text-base font-black text-emerald-700">{student.themesExplored}</p>
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Tema</p>
                        </div>
                        <div className="flex-1 bg-sky-50 rounded-xl py-2 px-3 text-center border border-sky-100">
                          <p className="text-base font-black text-sky-700">{student.fulfilledSubIndicators}</p>
                          <p className="text-[9px] font-black text-sky-500 uppercase tracking-wider">Sub-Ind.</p>
                        </div>
                        <div className="flex-1 bg-amber-50 rounded-xl py-2 px-3 text-center border border-amber-100">
                          <p className="text-base font-black text-amber-700">{student.reportsCount}</p>
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-wider">Laporan</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. RECENT ACTIVITY */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
              <TrendingUp size={10} /> Histori Terbaru
            </div>
          </div>
          <div className="bg-white rounded-[2rem] overflow-hidden border-2 border-slate-100" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
            {recentReports.length === 0 ? (
              <div className="p-10 text-center text-slate-300">
                <TrendingUp className="w-8 h-8 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">Belum ada laporan</p>
              </div>
            ) : (
              recentReports.map((report: any, idx: number) => {
                const plan = typeof report.treatment_plan === "string"
                  ? (() => { try { return JSON.parse(report.treatment_plan); } catch { return null; } })()
                  : report.treatment_plan;
                const assessments = Array.isArray(plan?.detailed_assessments) ? plan.detailed_assessments : [];
                const themesCount = new Set(
                  assessments.map((a: any) => String(a?.theme ?? "").trim().toLowerCase()).filter(Boolean)
                ).size;
                const fulfilledCount = assessments.reduce(
                  (acc: number, a: any) => acc + (Array.isArray(a?.fulfilled_sub_indicators) ? a.fulfilled_sub_indicators.length : 0),
                  0
                );

                return (
                  <Link
                    href={`/reports/${report.id}?from=${encodeURIComponent("/students")}`}
                    key={report.id}
                    className={`flex items-center justify-between px-5 py-4 hover:bg-emerald-50 transition-colors ${
                      idx !== recentReports.length - 1 ? "border-b-2 border-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-700 text-sm">
                        {report.students?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm leading-tight">{report.students?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {new Date(report.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{themesCount} tema</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">{fulfilledCount} SI</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
