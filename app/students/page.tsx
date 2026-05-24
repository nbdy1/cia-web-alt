"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { useUserRole } from "@/lib/useUserRole";
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
      `);
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

  // ── Loading state ─────────────────────────────────────────────────────────
  if (roleLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Memuat data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-emerald-900 px-6 pt-12 pb-12 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <LayoutDashboard size={120} className="text-white" />
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-emerald-300 hover:text-white transition-colors mb-6 group bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm"
        >
          <ChevronLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Beranda
          </span>
        </Link>

        <h1 className="text-4xl font-bold text-white tracking-tight">
          Analitik Santri
        </h1>

        
      </header>

      <main className="px-6 -mt-6 space-y-8 relative z-10">
        {/* 1. STUDENT DIRECTORY */}
        <section>
          <div className="flex items-center justify-between mb-4 px-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={12} /> Santriku ({students.length})
            </h3>
          </div>
          {students.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <Users className="w-8 h-8 mx-auto mb-3 text-slate-200" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Belum ada santri yang ditugaskan
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {students.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="block bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm active:scale-[0.98] transition-all hover:border-emerald-200"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-100">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xl tracking-tight font-serif">
                          {student.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">
                          {student.batch || "Reguler"}
                        </p>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-full">
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-50 rounded-2xl py-2 px-3 flex items-center justify-center gap-2">
                      <Bookmark size={12} className="text-emerald-700" />
                      <span className="text-[10px] font-black text-emerald-700">
                        {student.themesExplored} Tema Dieksplorasi
                      </span>
                    </div>
                    <div className="flex-1 bg-sky-50 rounded-2xl py-2 px-3 flex items-center justify-center gap-2">
                      <CheckCircle2 size={12} className="text-sky-700" />
                      <span className="text-[10px] font-black text-sky-700">
                        {student.fulfilledSubIndicators} Sub-indikator Terpenuhi
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl py-2 px-3 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-600">
                        {student.reportsCount} Laporan
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 2. RECENT ACTIVITY */}
        <section>
          <div className="flex items-center justify-between mb-4 px-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Histori
            </h3>
          </div>
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm">
            {recentReports.length === 0 ? (
              <div className="p-10 text-center text-slate-300">
                <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">Belum ada laporan</p>
              </div>
            ) : (
              recentReports.map((report: any, idx: number) => {
                const plan = typeof report.treatment_plan === "string"
                  ? (() => {
                      try {
                        return JSON.parse(report.treatment_plan);
                      } catch {
                        return null;
                      }
                    })()
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
                    href={`/reports/${report.id}`}
                    key={report.id}
                    className={`flex items-center justify-between p-6 hover:bg-slate-50 transition-colors ${
                      idx !== recentReports.length - 1 ? "border-b border-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">
                        {report.students?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {report.students?.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                          {report.title || "Laporan Perkembangan"}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {new Date(report.created_at).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-700">
                        {themesCount} tema
                      </p>
                      <p className="text-[10px] font-black text-sky-700">
                        {fulfilledCount} sub-indikator
                      </p>
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
