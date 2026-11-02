/**
 * app/bk/history/page.tsx
 *
 * Mode BK history, organised per student: one row per student who has counselling
 * notes (how many, when last, whether any needed immediate attention), opening that
 * student's own timeline at /bk/students/[id]. The earlier flat, newest-first list
 * is kept as the "Terbaru" view for people who prefer it.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, ClipboardList, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-paging";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { StudentAvatar } from "@/components/StudentAvatar";

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  student_id: string;
  // Only the flag is pulled out of the JSON, not the whole analysis.
  needs_attention: string | null;
  students: { id: string; name: string; photo_url: string | null } | null;
};

type StudentGroup = {
  id: string;
  name: string;
  photoUrl: string | null;
  count: number;
  lastAt: string;
  flagged: boolean;
};

export default function BpHistoryPage() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"students" | "latest">("students");

  useEffect(() => {
    if (!activeOrganizationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const rows = await fetchAllRows<SessionRow>((from, to) =>
          supabase
            .from("bp_reports")
            .select("id, title, created_at, student_id, needs_attention:analysis->>needs_immediate_attention, students(id, name, photo_url)")
            .eq("organization_id", activeOrganizationId)
            .order("created_at", { ascending: false })
            .range(from, to) as unknown as PromiseLike<{ data: SessionRow[] | null; error: { message: string } | null }>,
        );
        if (!cancelled) setSessions(rows);
      } catch (loadError) {
        console.error("Failed to load BK history:", loadError);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId]);

  const groups = useMemo<StudentGroup[]>(() => {
    const byStudent = new Map<string, StudentGroup>();
    for (const session of sessions) {
      const existing = byStudent.get(session.student_id);
      const flagged = session.needs_attention === "true";
      if (existing) {
        existing.count += 1;
        existing.flagged ||= flagged;
        if (session.created_at > existing.lastAt) existing.lastAt = session.created_at;
      } else {
        byStudent.set(session.student_id, {
          id: session.student_id,
          // A teacher may have written about a student outside their roster, whose row they cannot read.
          name: session.students?.name ?? t.santri,
          photoUrl: session.students?.photo_url ?? null,
          count: 1,
          lastAt: session.created_at,
          flagged,
        });
      }
    }
    return [...byStudent.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [sessions, t.santri]);

  const q = query.trim().toLowerCase();
  const visibleGroups = groups.filter((group) => !q || group.name.toLowerCase().includes(q));
  const visibleSessions = sessions.filter((session) => !q || `${session.title} ${session.students?.name ?? ""}`.toLowerCase().includes(q));

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="border-b-2 border-slate-100 bg-white px-6 pb-5 pt-9" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" />
          {isEnglish ? "Home" : "Beranda"}
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white" style={{ boxShadow: "0 4px 0 var(--brand-700)" }}>
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling mode" : "Mode BK"}</p>
            <h1 className="text-2xl font-bold text-slate-800">{isEnglish ? "Counselling history" : "Riwayat bimbingan"}</h1>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-6 pt-6">
        <Link
          href="/bk/monthly"
          className="flex items-center gap-3 rounded-2xl border-2 border-brand-100 bg-brand-50 p-3.5 transition-colors hover:border-brand-200"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
            <CalendarRange className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-brand-900">{isEnglish ? "Monthly reports" : "Rapor bulanan"}</span>
            <span className="block text-[11px] font-bold text-brand-700">
              {isEnglish ? "Create a monthly summary for the students who need one" : "Buat ringkasan bulanan untuk siswa yang membutuhkannya"}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand-500" />
        </Link>

        <label className="relative block">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isEnglish ? "Search students or notes…" : `Cari ${t.santriLower} atau catatan…`}
            className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-brand-300"
            style={{ boxShadow: "0 3px 0 #e2e8f0" }}
          />
        </label>

        <div className="flex w-fit rounded-2xl bg-slate-100 p-1" role="tablist">
          {([
            { id: "students", label: isEnglish ? "By student" : `Per ${t.santriLower}` },
            { id: "latest", label: isEnglish ? "Latest" : "Terbaru" },
          ] as const).map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={view === option.id}
              onClick={() => setView(option.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${view === option.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border-2 border-dashed border-rose-200 px-5 py-10 text-center text-sm font-bold text-slate-500">
            {isEnglish ? "Could not load the history. Please reopen this page." : "Riwayat belum bisa dimuat. Silakan buka halaman ini kembali."}
          </div>
        ) : view === "students" ? (
          <div className="space-y-3">
            {visibleGroups.map((group, index) => (
              <Link
                key={group.id}
                href={`/bk/students/${group.id}?name=${encodeURIComponent(group.name)}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3 hover:border-brand-200"
                style={{ boxShadow: "0 3px 0 #e2e8f0" }}
              >
                <StudentAvatar name={group.name} photoUrl={group.photoUrl} size="md" colorIndex={index} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-slate-800">{group.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-400">
                    <span>{group.count} {isEnglish ? (group.count === 1 ? "session" : "sessions") : "sesi"}</span>
                    <span>·</span>
                    <span>{isEnglish ? "last" : "terakhir"} {formatDate(group.lastAt)}</span>
                    {group.flagged && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                        <AlertTriangle className="h-3 w-3" />
                        {isEnglish ? "Needed attention" : "Pernah perlu perhatian"}
                      </span>
                    )}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            ))}
            {!visibleGroups.length && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-10 text-center text-sm font-bold text-slate-400">
                {query ? (isEnglish ? "No matching students." : `${t.santri} tidak ditemukan.`) : (isEnglish ? "No counselling notes yet." : "Belum ada catatan bimbingan.")}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleSessions.map((session, index) => (
              <Link
                key={session.id}
                href={`/bk/reports/${session.id}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3 hover:border-brand-200"
                style={{ boxShadow: "0 3px 0 #e2e8f0" }}
              >
                <StudentAvatar name={session.students?.name ?? t.santri} photoUrl={session.students?.photo_url} size="md" colorIndex={index} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-slate-800">{session.title}</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-400">
                    {session.students?.name ?? t.santri} • {new Date(session.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            ))}
            {!visibleSessions.length && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-10 text-center text-sm font-bold text-slate-400">
                {isEnglish ? "No counselling notes yet." : "Belum ada catatan bimbingan."}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
