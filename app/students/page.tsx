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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Users,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Loader2,
  Search,
  ArrowUpDown,
  X,
} from "lucide-react";
import Link from "next/link";
import { StudentAvatar } from "@/components/StudentAvatar";

type StudentWithStats = {
  id: string;
  name: string;
  nis: string | null;
  photo_url: string | null;
  assigned_ustadz_id: string | null;
  reportsCount: number;
  themesExplored: number;
  fulfilledSubIndicators: number;
  lastReportAt: string | null;
};

const SORT_STORAGE_KEY = "cia:students-sort";
const PAGE_SIZE = 10;

type SortOption = "name-asc" | "recent-desc" | "tema-desc" | "subind-desc" | "laporan-desc";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "name-asc", label: "Nama (A-Z)" },
  { id: "recent-desc", label: "Terbaru" },
  { id: "tema-desc", label: "Tema Terbanyak" },
  { id: "subind-desc", label: "Sub-Indikator Terbanyak" },
  { id: "laporan-desc", label: "Laporan Terbanyak" },
];

function getInitialSort(): SortOption {
  if (typeof window === "undefined") return "name-asc";
  try {
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    return SORT_OPTIONS.some((o) => o.id === stored) ? (stored as SortOption) : "name-asc";
  } catch {
    return "name-asc";
  }
}

type RecentReport = {
  id: string;
  title: string | null;
  created_at: string;
  students: { name: string } | null;
  treatment_plan: any;
};

export default function StudentsAnalyticsPage() {
  const { user, activeOrganizationId } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>(getInitialSort);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [dragDirection, setDragDirection] = useState(1);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortOption);
    } catch {}
  }, [sortOption]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }
    if (isSortOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSortOpen]);

  useEffect(() => {
    if (roleLoading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      const isAdmin = role === "admin" || role === "owner";
      const ustadzId = isAdmin ? null : user.id;

      // ── 1. Fetch students (with optional ustadz filter) ──────────────────
      let studentsQuery = supabase.from("students").select(`
        *,
        reports (
          id,
          treatment_plan,
          created_at
        )
      `).or('is_removed.is.null,is_removed.eq.false');
      
      // Filter by active organization
      if (activeOrganizationId) {
        studentsQuery = studentsQuery.eq("organization_id", activeOrganizationId);
      }

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
        let lastReportAt: string | null = null;

        reports.forEach((r: any) => {
          if (r.created_at && (!lastReportAt || r.created_at > lastReportAt)) {
            lastReportAt = r.created_at;
          }
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
          nis: student.nis,
          photo_url: student.photo_url ?? null,
          assigned_ustadz_id: student.assigned_ustadz_id,
          reportsCount: reports.length,
          themesExplored: themeSet.size,
          fulfilledSubIndicators,
          lastReportAt,
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

      // Without this, an admin/owner of multiple orgs would see recent
      // reports from every org they administer, not just the active one.
      if (activeOrganizationId) {
        recentQuery = recentQuery.eq("organization_id", activeOrganizationId);
      }

      if (!isAdmin && studentIds.length > 0) {
        recentQuery = recentQuery.in("student_id", studentIds);
      }

      const { data: recentRaw } = await recentQuery;
      setRecentReports((recentRaw ?? []) as any);

      setDataLoading(false);
    };

    fetchData();
  }, [user, role, roleLoading, activeOrganizationId]);

  const filteredSortedStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = query
      ? students.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            (s.nis ?? "").toLowerCase().includes(query)
        )
      : students;

    list = [...list];
    switch (sortOption) {
      case "recent-desc":
        list.sort((a, b) => (b.lastReportAt ?? "").localeCompare(a.lastReportAt ?? ""));
        break;
      case "tema-desc":
        list.sort((a, b) => b.themesExplored - a.themesExplored);
        break;
      case "subind-desc":
        list.sort((a, b) => b.fulfilledSubIndicators - a.fulfilledSubIndicators);
        break;
      case "laporan-desc":
        list.sort((a, b) => b.reportsCount - a.reportsCount);
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [students, searchQuery, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedStudents.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [searchQuery, sortOption]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const pagedStudents = filteredSortedStudents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const goToPage = (next: number) => {
    if (next < 0 || next > totalPages - 1) return;
    setDragDirection(next > page ? 1 : -1);
    setPage(next);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (roleLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center animate-bounce-in" style={{ boxShadow: "0 4px 0 0 var(--brand-200)" }}>
          <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
        </div>
        <p className="text-brand-600 text-xs font-black uppercase tracking-widest">Memuat data…</p>
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
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-brand-600 transition-colors">
            Beranda
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-brand-500 rounded-[1.2rem] flex items-center justify-center" style={{ boxShadow: "0 4px 0 0 var(--brand-700)" }}>
            <LayoutDashboard size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 leading-none">Santri</h1>
            <p className="text-brand-600 text-xs font-black uppercase tracking-widest mt-0.5">Analitik & Histori</p>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {/* 1. STUDENT DIRECTORY */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
              <Users size={10} /> {filteredSortedStudents.length} Santri
            </div>
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NIS santri…"
                className="w-full border-2 border-slate-200 bg-white rounded-2xl py-3 pl-11 pr-10 font-bold text-sm text-slate-800 outline-none focus:border-brand-400 transition-all"
                style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  title="Bersihkan"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortOpen((v) => !v)}
                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-2xl border-2 transition-all active:translate-y-px ${
                  isSortOpen ? "bg-brand-500 text-white border-brand-400" : "bg-white text-slate-500 border-slate-200"
                }`}
                style={{ boxShadow: isSortOpen ? "0 3px 0 0 var(--brand-700)" : "0 3px 0 0 #e2e8f0" }}
                title="Urutkan"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {isSortOpen && (
                <div
                  className="absolute right-0 top-[3.25rem] z-30 w-56 bg-white rounded-2xl border-2 border-slate-100 p-1.5 animate-fade-in"
                  style={{ boxShadow: "0 5px 0 0 #e2e8f0" }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortOption(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-xs font-black transition-colors ${
                        sortOption === option.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                      {sortOption === option.id && <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {filteredSortedStudents.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-black text-slate-400">
                {searchQuery ? "Santri tidak ditemukan" : "Belum ada santri"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden pb-2">
                <AnimatePresence mode="wait" custom={dragDirection}>
                  <motion.div
                    key={page}
                    custom={dragDirection}
                    initial={{ x: dragDirection > 0 ? 60 : -60, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: dragDirection > 0 ? -60 : 60, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                      const threshold = 60;
                      if (info.offset.x < -threshold || info.velocity.x < -400) {
                        goToPage(page + 1);
                      } else if (info.offset.x > threshold || info.velocity.x > 400) {
                        goToPage(page - 1);
                      }
                    }}
                    className="grid gap-4"
                  >
              {pagedStudents.map((student, i) => {
                return (
                  <Link
                    key={student.id}
                    href={`/students/${student.id}?from=${encodeURIComponent("/students")}`}
                    className="card-3d-link block"
                  >
                    <div className="card-3d p-5">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            name={student.name}
                            photoUrl={student.photo_url}
                            size="md"
                            colorIndex={i}
                          />
                          <div>
                            <p className="font-black text-slate-900 text-lg leading-tight">
                              {student.name}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {student.nis ? `NIS: ${student.nis}` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 bg-brand-50 rounded-xl py-2 px-3 text-center border border-brand-100">
                          <p className="text-base font-black text-brand-700">{student.themesExplored}</p>
                          <p className="text-[9px] font-black text-brand-500 uppercase tracking-wider">Tema</p>
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
                  </motion.div>
                </AnimatePresence>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 text-slate-400 disabled:opacity-30 active:translate-y-px transition-all"
                    style={{ boxShadow: "0 2px 0 0 #e2e8f0" }}
                    title="Sebelumnya"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }).map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      onClick={() => goToPage(dotIdx)}
                      className={`rounded-full transition-all ${
                        dotIdx === page ? "w-5 h-2 bg-brand-500" : "w-2 h-2 bg-slate-200"
                      }`}
                      title={`Halaman ${dotIdx + 1}`}
                    />
                  ))}
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page === totalPages - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 text-slate-400 disabled:opacity-30 active:translate-y-px transition-all"
                    style={{ boxShadow: "0 2px 0 0 #e2e8f0" }}
                    title="Selanjutnya"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
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
                    className={`flex items-center justify-between gap-3 px-5 py-4 hover:bg-brand-50 transition-colors ${
                      idx !== recentReports.length - 1 ? "border-b-2 border-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar
                        name={report.students?.name ?? "?"}
                        photoUrl={null}
                        size="sm"
                        colorIndex={0}
                      />
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-sm leading-tight">{report.students?.name}</p>
                        {report.title && (
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate max-w-[10rem]">
                            {report.title}
                          </p>
                        )}
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {new Date(report.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                          {" · "}
                          {new Date(report.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">{themesCount} tema</span>
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
