/**
 * app/bk/students/[id]/page.tsx
 *
 * One student's counselling file: every session, grouped by month (newest first).
 * Each month header carries that month's "Rapor bulanan" — create it (on demand),
 * open the draft, or see it is final. Nothing here calls the AI on its own; the AI
 * only runs when someone taps "Buat rapor bulanan".
 */
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, CheckCircle2, FileText, Loader2, MessageSquareHeart, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-paging";
import { useAuth } from "@/lib/context/auth-context";
import { useSettings } from "@/lib/context/settings-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { StudentAvatar } from "@/components/StudentAvatar";
import { generateBpMonthlySummary } from "@/app/actions/bp-monthly";
import { clip, monthKeyFromIso, monthLabel, summaryState, type SummaryState } from "@/lib/bk-monthly";

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  needs_attention: string | null;
  preview: string | null;
};

type SummaryRow = { id: string; period_month: string; status: "draft" | "final"; source_report_ids: string[] };

export default function BkStudentPage() {
  const { id: studentId } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { activeOrganizationId } = useAuth();
  const { selectedModel, temperature, language } = useSettings();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";

  const [student, setStudent] = useState<{ name: string; photo_url: string | null; nis: string | null } | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyMonth, setBusyMonth] = useState<string | null>(null);
  const [monthError, setMonthError] = useState<{ month: string; message: string } | null>(null);

  useEffect(() => {
    if (!studentId || !activeOrganizationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const [studentResult, sessionRows, summaryResult] = await Promise.all([
          supabase.from("students").select("name, photo_url, nis").eq("id", studentId).maybeSingle(),
          fetchAllRows<SessionRow>((from, to) =>
            supabase
              .from("bp_reports")
              .select("id, title, created_at, needs_attention:analysis->>needs_immediate_attention, preview:analysis->>summary")
              .eq("student_id", studentId)
              .order("created_at", { ascending: false })
              .range(from, to) as unknown as PromiseLike<{ data: SessionRow[] | null; error: { message: string } | null }>,
          ),
          supabase.from("bp_monthly_summaries").select("id, period_month, status, source_report_ids").eq("student_id", studentId),
        ]);
        if (cancelled) return;
        setStudent(studentResult.data ?? null);
        setSessions(sessionRows);
        // A missing table (migration not applied yet) just means no monthly reports exist yet.
        setSummaries((summaryResult.data ?? []) as SummaryRow[]);
      } catch (error) {
        console.error("Failed to load BK student page:", error);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, activeOrganizationId]);

  const months = useMemo(() => {
    const byMonth = new Map<string, SessionRow[]>();
    for (const session of sessions) {
      const key = monthKeyFromIso(session.created_at);
      if (!key) continue;
      byMonth.set(key, [...(byMonth.get(key) ?? []), session]);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, list]) => {
        const summary = summaries.find((row) => row.period_month.slice(0, 7) === key) ?? null;
        return { key, sessions: list, summary, state: summaryState(summary, list.map((s) => s.id)) as SummaryState };
      });
  }, [sessions, summaries]);

  const name = student?.name ?? search.get("name") ?? t.santri;

  async function createSummary(month: string) {
    setBusyMonth(month);
    setMonthError(null);
    const result = await generateBpMonthlySummary(studentId, month, { model: selectedModel, temperature, language });
    setBusyMonth(null);
    if (!result.success) {
      setMonthError({ month, message: result.error });
      return;
    }
    router.push(`/bk/monthly/${result.id}`);
  }

  const stateChip: Record<SummaryState, { label: string; tone: string } | null> = {
    missing: null,
    draft: { label: isEnglish ? "Draft" : "Draft", tone: "bg-amber-100 text-amber-700" },
    outdated: { label: isEnglish ? "New sessions" : "Ada sesi baru", tone: "bg-sky-100 text-sky-700" },
    final: { label: isEnglish ? "Final" : "Final", tone: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <div className="min-h-screen bg-paper pb-28">
      <header className="border-b-2 border-slate-100 bg-white px-6 pb-5 pt-9" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
        <Link href="/bk/history" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" />
          {isEnglish ? "History" : "Riwayat"}
        </Link>
        <div className="mt-5 flex items-center gap-4">
          <StudentAvatar name={name} photoUrl={student?.photo_url ?? null} size="lg" colorIndex={0} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling file" : "Berkas bimbingan"}</p>
            <h1 className="truncate text-2xl font-bold text-slate-800">{name}</h1>
            <p className="mt-0.5 text-xs font-bold text-slate-400">
              {sessions.length} {isEnglish ? (sessions.length === 1 ? "session" : "sessions") : "sesi"}
              {student?.nis ? ` · NIS ${student.nis}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-6 pt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
          </div>
        ) : loadFailed ? (
          <div className="rounded-2xl border-2 border-dashed border-rose-200 px-5 py-10 text-center text-sm font-bold text-slate-500">
            {isEnglish ? "Could not load this file. Please reopen the page." : "Berkas ini belum bisa dimuat. Silakan buka halaman ini kembali."}
          </div>
        ) : months.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-10 text-center text-sm font-bold text-slate-400">
            {isEnglish ? "No counselling sessions for this student yet." : `Belum ada sesi bimbingan untuk ${t.santriLower} ini.`}
          </div>
        ) : (
          months.map((month) => {
            const chip = stateChip[month.state];
            const flagged = month.sessions.some((s) => s.needs_attention === "true");
            const busy = busyMonth === month.key;
            return (
              <section key={month.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold capitalize text-slate-800">{monthLabel(month.key, locale)}</h2>
                    <p className="text-[11px] font-bold text-slate-400">
                      {month.sessions.length} {isEnglish ? (month.sessions.length === 1 ? "session" : "sessions") : "sesi"}
                    </p>
                  </div>
                  {chip && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${chip.tone}`}>{chip.label}</span>}
                </div>

                {/* The monthly rapor for this month. AI runs only when this is tapped. */}
                <div className="rounded-2xl border-2 border-brand-100 bg-brand-50 p-3.5">
                  {month.summary ? (
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600">
                        {month.state === "final" ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-brand-900">{isEnglish ? "Monthly report" : "Rapor bulanan"}</p>
                        <p className="text-[11px] font-bold text-brand-700">
                          {month.state === "outdated"
                            ? isEnglish ? "New sessions were added after it was made." : "Ada sesi baru sejak rapor ini dibuat."
                            : month.state === "final"
                              ? isEnglish ? "Reviewed and final." : "Sudah ditinjau dan final."
                              : isEnglish ? "Draft — review it before it is final." : "Draft — tinjau sebelum dijadikan final."}
                        </p>
                      </div>
                      <Link href={`/bk/monthly/${month.summary.id}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
                        {isEnglish ? "Open" : "Buka"} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600">
                        <CalendarRange className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-brand-900">{isEnglish ? "No monthly report yet" : "Belum ada rapor bulanan"}</p>
                        <p className="text-[11px] font-bold text-brand-700">
                          {month.sessions.length < 2
                            ? isEnglish ? "Only one session, so a summary adds little." : "Baru satu sesi, ringkasan belum banyak menambah."
                            : isEnglish ? "Summarised from this month's notes." : "Dirangkum dari catatan bulan ini."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => createSummary(month.key)}
                        disabled={busyMonth !== null}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white disabled:bg-slate-300"
                        style={busyMonth === null ? { boxShadow: "0 3px 0 var(--brand-700)" } : undefined}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {busy ? (isEnglish ? "Creating…" : "Membuat…") : (isEnglish ? "Create" : "Buat")}
                      </button>
                    </div>
                  )}
                  {month.summary && month.state === "outdated" && (
                    <button
                      type="button"
                      onClick={() => createSummary(month.key)}
                      disabled={busyMonth !== null}
                      className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-white px-3 text-xs font-bold text-brand-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {isEnglish ? "Update with the new sessions" : "Perbarui dengan sesi baru"}
                    </button>
                  )}
                  {monthError?.month === month.key && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{monthError.message}</p>}
                </div>

                {flagged && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {isEnglish ? "A session this month was marked as needing immediate attention." : "Ada sesi bulan ini yang ditandai perlu perhatian segera."}
                  </div>
                )}

                <div className="space-y-2.5">
                  {month.sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/bk/reports/${session.id}`}
                      className="block rounded-2xl border-2 border-slate-100 bg-white p-3.5 hover:border-brand-200"
                      style={{ boxShadow: "0 3px 0 #e2e8f0" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">{session.title}</p>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                        {new Date(session.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      {session.preview && <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{clip(session.preview, 180)}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[450px] -translate-x-1/2 border-t-2 border-slate-100 bg-white p-4">
        <Link
          href={`/bk/assessment?id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(name)}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-sm font-bold text-white"
          style={{ boxShadow: "0 4px 0 var(--brand-700)" }}
        >
          <MessageSquareHeart className="h-4 w-4" />
          {isEnglish ? "New counselling session" : "Sesi bimbingan baru"}
        </Link>
      </div>
    </div>
  );
}
