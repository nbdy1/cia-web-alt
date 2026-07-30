/**
 * app/admin/monitoring/page.tsx
 *
 * Ustadz workload monitoring view. Shows a hierarchical list:
 *   Ustadz → Students assigned to them → Reports per student
 *
 * Each report is a clickable link to /reports/[id]. This gives the admin a
 * quick way to audit which ustadz are actively submitting reports and which
 * students may be falling behind.
 *
 * Date range filter (Semua / Hari Ini / Kemarin / Minggu Ini / Minggu Lalu /
 * custom range): scopes the report counts and the expanded report list to a
 * period, and flags ustadz with zero reports in that period as "Tidak aktif"
 * — added so admins can answer "who was active this week?" at a glance,
 * without having to scroll every ustadz's full history. Filtering happens
 * client-side over the already-fetched data (no extra query per preset).
 *
 * Persistence (added so an admin auditing many reports in a row doesn't lose
 * their place every time they open one — see the "kurang satset" complaint
 * this was built for):
 *   - Search/filter/sort choices persist in localStorage (cia:monitoring-filters),
 *     same convention as the sort dropdown on app/students/page.tsx.
 *   - The fetched data + scroll position are cached in sessionStorage
 *     (cia:monitoring-cache / cia:monitoring-scroll) so navigating to a report
 *     and back restores instantly instead of re-fetching + re-scrolling.
 *   - A background refresh runs every REFRESH_INTERVAL_MS while the tab is
 *     visible; it only replaces state (and thus re-renders/re-sorts) when the
 *     fetched data actually differs from what's cached, so an admin sitting on
 *     this page doesn't get jolted by a re-render for no reason.
 *
 * Also serves as the fallback destination for ReportBackButton / SmartBackButton
 * when the admin navigates from a report detail page.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Search, Loader2, Users, FileText, ChevronRight, Calendar, AlertCircle, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { StudentAvatar } from '@/components/StudentAvatar';
import { useAuth } from '@/lib/context/auth-context';
import { useTerminology } from '@/lib/hooks/use-terminology';

// ─── Date range filter ────────────────────────────────────────────────────────

type PresetKey = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'custom';
type SortKey = 'az' | 'za' | 'most_reports' | 'least_reports' | 'most_recent' | 'least_recent';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: 'this_week', label: 'Minggu Ini' },
  { key: 'last_week', label: 'Minggu Lalu' },
  { key: 'custom', label: 'Pilih Tanggal' },
];

// Local (not UTC) YYYY-MM-DD key — created_at comparisons must use the
// admin's local calendar day, not a UTC-shifted one from toISOString().
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const monday = new Date(d);
  const dow = monday.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Returns the inclusive [fromKey, toKey] date-string range for a preset, or
 * null for 'all' (no filtering) / an incomplete custom range. */
function resolveRange(preset: PresetKey, customFrom: string, customTo: string): { from: string; to: string } | null {
  const now = new Date();
  switch (preset) {
    case 'all':
      return null;
    case 'today':
      return { from: dateKey(now), to: dateKey(now) };
    case 'yesterday': {
      const y = addDays(now, -1);
      return { from: dateKey(y), to: dateKey(y) };
    }
    case 'this_week': {
      const start = startOfWeek(now);
      return { from: dateKey(start), to: dateKey(addDays(start, 6)) };
    }
    case 'last_week': {
      const start = addDays(startOfWeek(now), -7);
      return { from: dateKey(start), to: dateKey(addDays(start, 6)) };
    }
    case 'custom':
      if (!customFrom) return null;
      return { from: customFrom, to: customTo || customFrom };
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const FILTERS_STORAGE_KEY = 'cia:monitoring-filters';
const SCROLL_STORAGE_KEY = 'cia:monitoring-scroll';
const CACHE_STORAGE_KEY = 'cia:monitoring-cache';
const REFRESH_INTERVAL_MS = 60_000;

type FilterState = {
  searchQuery: string;
  preset: PresetKey;
  customFrom: string;
  customTo: string;
  sortKey: SortKey;
  expandedUstadz: string | null;
};

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  preset: 'all',
  customFrom: '',
  customTo: '',
  sortKey: 'most_reports',
  expandedUstadz: null,
};

function getInitialFilters(): FilterState {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const stored = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!stored) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

// A cheap fingerprint of "everything that could change the rendered list" —
// used to skip a state update (and the re-render/re-sort it triggers) when a
// background refresh comes back with data identical to what's already shown.
function fingerprint(formattedData: any[]): string {
  return formattedData
    .map((u) => `${u.id}:${u.students.map((s: any) => `${s.id}[${s.reports.map((r: any) => r.id).join(',')}]`).join('|')}`)
    .join(';');
}

export default function MonitoringPage() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();

  // Lazily seeded from sessionStorage so navigating back from a report shows
  // the list instantly instead of a loading spinner + re-fetch.
  const [data, setData] = useState<any[]>(() => {
    if (typeof window === 'undefined' || !activeOrganizationId) return [];
    try {
      const cached = window.sessionStorage.getItem(`${CACHE_STORAGE_KEY}:${activeOrganizationId}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(data.length === 0);

  const initialFilters = useMemo(getInitialFilters, []);
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [expandedUstadz, setExpandedUstadz] = useState<string | null>(initialFilters.expandedUstadz);
  const [preset, setPreset] = useState<PresetKey>(initialFilters.preset);
  const [customFrom, setCustomFrom] = useState(initialFilters.customFrom);
  const [customTo, setCustomTo] = useState(initialFilters.customTo);
  const [sortKey, setSortKey] = useState<SortKey>(initialFilters.sortKey);

  // Persist filter/search/sort choices so they survive navigating away and back.
  useEffect(() => {
    const state: FilterState = { searchQuery, preset, customFrom, customTo, sortKey, expandedUstadz };
    try {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable (private browsing) — safe to skip persisting.
    }
  }, [searchQuery, preset, customFrom, customTo, sortKey, expandedUstadz]);

  // Restore scroll position once data is showing, then keep saving it as the
  // admin scrolls so it's there whenever they come back from a report.
  //
  // A single scrollTo() on mount isn't enough: Next.js's App Router disables
  // native browser scroll restoration and does its own (to-top) handling on
  // back/forward navigation (popstate), which can run AFTER this effect and
  // silently undo a single restore attempt — hence the browser-back/swipe-
  // back case landing at the top despite this code running. Re-asserting the
  // saved position across a few animation frames, and re-running on every
  // popstate (back/forward) and pageshow (bfcache restore), wins that race.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const restoreScroll = () => {
      let savedY: string | null;
      try {
        savedY = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
      } catch {
        return;
      }
      if (!savedY) return;
      const y = parseInt(savedY, 10);
      let attempts = 0;
      const tryScroll = () => {
        if (cancelled) return;
        window.scrollTo(0, y);
        attempts++;
        if (attempts < 8) requestAnimationFrame(tryScroll);
      };
      tryScroll();
    };

    restoreScroll();
    window.addEventListener('popstate', restoreScroll);
    window.addEventListener('pageshow', restoreScroll);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', restoreScroll);
      window.removeEventListener('pageshow', restoreScroll);
    };
  }, [loading]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
        } catch {
          // ignore
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const inRange = React.useCallback(
    (createdAt: string) => {
      if (!range) return true;
      const key = dateKey(new Date(createdAt));
      return key >= range.from && key <= range.to;
    },
    [range]
  );

  // Seeded from the cached data (if any) so a background refresh that comes
  // back identical to the cache doesn't trigger a redundant re-render.
  const lastFingerprint = useRef<string | null>(data.length > 0 ? fingerprint(data) : null);

  const fetchMonitoringData = useCallback(async (showSpinner: boolean) => {
    if (!activeOrganizationId) return;
    if (showSpinner) setLoading(true);
    try {
      // Ustadz membership is scoped via organization_members — querying
      // `profiles` directly would (per RLS) return ustadz from every org
      // this admin belongs to, not just the active one.
      const { data: memberRows, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', activeOrganizationId)
        .eq('role', 'ustadz');

      if (membersError) throw membersError;
      const ustadzIds = (memberRows ?? []).map((m: any) => m.user_id);

      const { data: ustadzList, error: ustadzError } = ustadzIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, name')
            .in('id', ustadzIds)
            .or('is_removed.is.null,is_removed.eq.false')
            .order('name')
        : { data: [] as any[], error: null };

      if (ustadzError) throw ustadzError;

      // Fetch all students (in this org) with their reports
      const { data: studentsList, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          photo_url,
          assigned_ustadz_id,
          reports (
            id,
            created_at,
            title,
            created_by,
            narrative
          )
        `)
        .eq('organization_id', activeOrganizationId)
        .or('is_removed.is.null,is_removed.eq.false')
        .order('name');

      if (studentsError) throw studentsError;

      // Map students to their Ustadz
      const formattedData = (ustadzList || []).map(ustadz => {
        const assignedStudents = (studentsList || []).filter(s => s.assigned_ustadz_id === ustadz.id);
        const assignedStudentIds = new Set(assignedStudents.map((student) => student.id));
        const crossAssignmentStudents = (studentsList || [])
          .filter((student) => !assignedStudentIds.has(student.id))
          .map((student) => ({
            ...student,
            // A report belongs in the maker's monitoring section when they
            // authored it for a student outside their assigned roster.
            reports: (student.reports || []).filter((report: any) => report.created_by === ustadz.id),
          }))
          .filter((student) => student.reports.length > 0);

        return {
          ...ustadz,
          students: [
            ...assignedStudents.map((student) => ({ ...student, isCrossAssignment: false })),
            ...crossAssignmentStudents.map((student) => ({ ...student, isCrossAssignment: true })),
          ].map(student => ({
            ...student,
            // Sort reports by newest first
            reports: (student.reports || []).sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          }))
        };
      });

      // Skip the state update (and the re-render/re-sort it triggers) when a
      // background refresh comes back identical to what's already on screen.
      const fp = fingerprint(formattedData);
      if (fp !== lastFingerprint.current) {
        lastFingerprint.current = fp;
        setData(formattedData);
        try {
          window.sessionStorage.setItem(`${CACHE_STORAGE_KEY}:${activeOrganizationId}`, JSON.stringify(formattedData));
        } catch {
          // sessionStorage unavailable/full — safe to skip caching.
        }
      }
    } catch (err) {
      console.error("Error fetching monitoring data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    // Show the spinner only when there's nothing cached to show meanwhile.
    fetchMonitoringData(data.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId]);

  // Background revalidation — quietly re-fetches on an interval so the admin
  // sees new reports without a manual refresh, but only while the tab is
  // actually visible (no point burning requests on a backgrounded tab).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMonitoringData(false);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMonitoringData]);

  // Scope each ustadz's students/reports to the selected date range, and flag
  // whether they had any activity in it — this is what actually answers
  // "who was active this week and who wasn't" at a glance.
  const periodData = useMemo(
    () =>
      data.map((ustadz) => {
        const students = ustadz.students.map((s: any) => ({
          ...s,
          periodReports: s.reports.filter((r: any) => inRange(r.created_at)),
        }));
        const periodReportCount = students.reduce((acc: number, s: any) => acc + s.periodReports.length, 0);
        return { ...ustadz, students, periodReportCount, isActive: periodReportCount > 0 };
      }),
    [data, inRange]
  );

  const filteredData = periodData.filter(ustadz => {
    // Match ustadz name
    if (ustadz.name?.toLowerCase().includes(searchQuery.toLowerCase())) return true;

    // Match student name under this ustadz
    const hasMatchingStudent = ustadz.students.some((s: any) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return hasMatchingStudent;
  });

  const sortedData = useMemo(() => {
    const latestTimestamp = (ustadz: any) => {
      const timestamps = ustadz.students.flatMap((s: any) => s.periodReports.map((r: any) => new Date(r.created_at).getTime()));
      return timestamps.length ? Math.max(...timestamps) : 0;
    };
    return [...filteredData].sort((a, b) => {
      switch (sortKey) {
        case 'az': return a.name.localeCompare(b.name, 'id');
        case 'za': return b.name.localeCompare(a.name, 'id');
        case 'least_reports': return a.periodReportCount - b.periodReportCount || a.name.localeCompare(b.name, 'id');
        case 'most_recent': return latestTimestamp(b) - latestTimestamp(a) || b.periodReportCount - a.periodReportCount;
        case 'least_recent': return latestTimestamp(a) - latestTimestamp(b) || a.name.localeCompare(b.name, 'id');
        case 'most_reports':
        default: return b.periodReportCount - a.periodReportCount || a.name.localeCompare(b.name, 'id');
      }
    });
  }, [filteredData, sortKey]);

  const activeData = sortedData.filter((ustadz) => ustadz.isActive);
  const inactiveData = sortedData.filter((ustadz) => !ustadz.isActive);
  const groups = range ? [
    { label: 'Aktif pada periode ini', items: activeData },
    { label: 'Belum ada laporan pada periode ini', items: inactiveData },
  ] : [{ label: '', items: sortedData }];

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Monitor Laporan</h2>
        <p className="text-slate-400 text-sm font-bold mt-0.5">Progres laporan {t.santriLower} per {t.ustadzLower} pembimbing</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={`Cari ${t.ustadz} atau ${t.santri}…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400 transition-all"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />
      </div>

      {/* Date range filter */}
      <div className="space-y-2.5">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all border-2 whitespace-nowrap ${
                preset === p.key
                  ? "bg-brand-500 text-white border-brand-400"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
              style={preset === p.key ? { boxShadow: "0 3px 0 0 var(--brand-700)" } : { boxShadow: "0 3px 0 0 #e2e8f0" }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-2xl p-3" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Dari</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Sampai (opsional)</label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 bg-white border-2 border-slate-200 rounded-2xl p-3" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
        <BarChart3 size={15} className="text-brand-500 shrink-0" />
        <label htmlFor="monitoring-sort" className="text-xs font-black text-slate-600 whitespace-nowrap">Urutkan:</label>
        <select
          id="monitoring-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="min-w-0 flex-1 bg-transparent text-xs font-black text-slate-700 outline-none"
        >
          <option value="az">Nama A-Z</option>
          <option value="za">Nama Z-A</option>
          <option value="most_reports">Laporan terbanyak</option>
          <option value="least_reports">Laporan tersedikit</option>
          <option value="most_recent">Laporan terbaru</option>
          <option value="least_recent">Laporan terlama</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
        </div>
      ) : filteredData.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <React.Fragment key={group.label || 'all'}>
              {group.label && group.items.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{group.label}</span>
                  <span className="text-[10px] font-black text-slate-400">{group.items.length}</span>
                </div>
              )}
              {group.items.map((ustadz) => {
            const isExpanded = expandedUstadz === ustadz.id;
            const totalStudents = ustadz.students.filter((student: any) => !student.isCrossAssignment).length;
            const showInactive = !!range && !ustadz.isActive;

            return (
              <div
                key={ustadz.id}
                className={`bg-white rounded-[1.5rem] border-2 overflow-hidden ${showInactive ? "border-slate-100" : "border-brand-200"}`}
                style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}
              >
                <button
                  onClick={() => setExpandedUstadz(isExpanded ? null : ustadz.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-brand-500 text-white rounded-2xl flex items-center justify-center font-black text-base shrink-0" style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}>
                      {ustadz.name ? ustadz.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">{ustadz.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-black border border-brand-100">
                          <Users size={9} /> {totalStudents} {t.santri}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100">
                          <BookOpen size={9} /> {ustadz.periodReportCount} Laporan
                        </span>
                        {showInactive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100">
                            Tidak aktif
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t-2 border-slate-50 pt-4 space-y-5">
                    {ustadz.students.length > 0 ? (
                      ustadz.students.map((student: any, studentIndex: number) => (
                        <React.Fragment key={`${student.id}-${student.isCrossAssignment ? 'cross' : 'assigned'}`}>
                        {student.isCrossAssignment && (studentIndex === 0 || !ustadz.students[studentIndex - 1].isCrossAssignment) && (
                          <div className="flex items-center gap-2 pt-1 pb-0">
                            <div className="h-px flex-1 bg-amber-100" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 whitespace-nowrap">
                              Laporan dari luar bimbingan Anda
                            </span>
                            <div className="h-px flex-1 bg-amber-100" />
                          </div>
                        )}
                        <div className={student.isCrossAssignment ? "rounded-2xl bg-amber-50/50 p-2 -mx-2" : ""}>
                          <div className="flex items-center gap-2 mb-2">
                            <StudentAvatar
                              name={student.name}
                              photoUrl={student.photo_url ?? null}
                              size="sm"
                              colorIndex={0}
                              className="w-7 h-7 rounded-xl"
                            />
                            <span className="font-black text-slate-700 text-sm">{student.name}</span>
                            {student.isCrossAssignment && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black">
                                Bukan bimbingan Anda
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">
                              {student.periodReports.length} laporan
                            </span>
                          </div>
                          {student.periodReports.length > 0 ? (
                            <div className="pl-3 border-l-2 border-slate-100 ml-3.5 space-y-2">
                              {student.periodReports.map((report: any) => (
                                <div key={report.id} className="bg-slate-50 rounded-xl p-3.5 border-2 border-slate-100 hover:border-brand-200 transition-colors">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                      <Calendar size={11} className="text-brand-500" />
                                      {new Date(report.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                      <span className="text-slate-300">·</span>
                                      {new Date(report.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Link href={`/students/${student.id}?from=${encodeURIComponent("/admin/monitoring")}`} className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-1 rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors flex items-center gap-1">
                                        <Users size={10} /> Profil
                                      </Link>
                                      <Link href={`/reports/${report.id}?from=${encodeURIComponent("/admin/monitoring")}`} className="text-[10px] font-black text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border-2 border-brand-200 hover:bg-brand-100 transition-colors flex items-center gap-1">
                                        <FileText size={10} /> Detail
                                      </Link>
                                    </div>
                                  </div>
                                  {report.title && <p className="text-xs font-black text-slate-700 line-clamp-1 mb-1">{report.title}</p>}
                                  <p className="text-xs text-slate-500 italic line-clamp-2 leading-relaxed font-bold">"{report.narrative?.slice(0, 120)}…"</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-bold ml-3.5 pl-3 border-l-2 border-slate-100 py-1">
                              {range ? "Tidak ada laporan pada periode ini." : "Belum ada laporan."}
                            </p>
                          )}
                        </div>
                        </React.Fragment>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <AlertCircle className="w-7 h-7 mx-auto text-amber-300 mb-2" />
                        <p className="text-sm text-slate-400 font-black">Belum ada {t.santriLower} yang ditugaskan.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
              })}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <BookOpen className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-black text-sm">
            {searchQuery ? "Tidak ada hasil pencarian" : "Belum ada data monitoring"}
          </p>
        </div>
      )}
    </div>
  );
}
