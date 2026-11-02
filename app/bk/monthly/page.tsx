/**
 * app/bk/monthly/page.tsx
 *
 * "Rapor bulanan" overview for Mode BK: pick a month, see which students had
 * counselling sessions in it, and create monthly reports for the ones you choose.
 *
 * Built so AI cost stays predictable:
 *   - only students WITH sessions that month are listed (no sessions = nothing to make);
 *   - nothing is selected by default and nothing runs automatically;
 *   - "suggested" students (several sessions, a safety flag) can be selected in one tap,
 *     single-session students are left for you to decide;
 *   - a confirmation states how many AI calls will be made before anything is sent;
 *   - one run is capped, and students whose report is already up to date are skipped.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-paging";
import { useAuth } from "@/lib/context/auth-context";
import { useSettings } from "@/lib/context/settings-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { generateBpMonthlySummary } from "@/app/actions/bp-monthly";
import { dateKeyInZone } from "@/lib/requirement-rules";
import {
  defaultReportMonth,
  isSuggestedForSummary,
  monthBounds,
  monthLabel,
  monthStartDate,
  recentMonthKeys,
  summaryState,
  type SummaryState,
} from "@/lib/bk-monthly";

const MAX_PER_RUN = 30;

type SessionRow = {
  id: string;
  student_id: string;
  needs_attention: string | null;
  students: { name: string; photo_url: string | null } | null;
};
type SummaryRow = { id: string; student_id: string; status: "draft" | "final"; source_report_ids: string[] };

type Row = {
  studentId: string;
  name: string;
  photoUrl: string | null;
  sessionIds: string[];
  flagged: boolean;
  summary: SummaryRow | null;
  state: SummaryState;
  suggested: boolean;
};

type RunState = "queued" | "running" | "created" | "updated" | "unchanged" | "error";

export default function BkMonthlyPage() {
  const { activeOrganizationId } = useAuth();
  const { selectedModel, temperature, language } = useSettings();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";

  const [today] = useState(() => dateKeyInZone(Date.now()) ?? "1970-01-01");
  const months = useMemo(() => recentMonthKeys(today, 6), [today]);
  const [month, setMonth] = useState(() => defaultReportMonth(today));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, { state: RunState; error?: string }>>({});

  useEffect(() => {
    if (!activeOrganizationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const { startIso, endIso } = monthBounds(month);
        const [sessionRows, summaryResult] = await Promise.all([
          fetchAllRows<SessionRow>((from, to) =>
            supabase
              .from("bp_reports")
              .select("id, student_id, needs_attention:analysis->>needs_immediate_attention, students(name, photo_url)")
              .eq("organization_id", activeOrganizationId)
              .gte("created_at", startIso)
              .lt("created_at", endIso)
              .range(from, to) as unknown as PromiseLike<{ data: SessionRow[] | null; error: { message: string } | null }>,
          ),
          supabase
            .from("bp_monthly_summaries")
            .select("id, student_id, status, source_report_ids")
            .eq("organization_id", activeOrganizationId)
            .eq("period_month", monthStartDate(month)),
        ]);
        if (cancelled) return;
        setSessions(sessionRows);
        setSummaries((summaryResult.data ?? []) as SummaryRow[]);
      } catch (error) {
        console.error("Failed to load BK monthly overview:", error);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, month, reloadKey]);

  const rows = useMemo<Row[]>(() => {
    const byStudent = new Map<string, Row>();
    for (const session of sessions) {
      const flagged = session.needs_attention === "true";
      const existing = byStudent.get(session.student_id);
      if (existing) {
        existing.sessionIds.push(session.id);
        existing.flagged ||= flagged;
      } else {
        byStudent.set(session.student_id, {
          studentId: session.student_id,
          name: session.students?.name ?? t.santri,
          photoUrl: session.students?.photo_url ?? null,
          sessionIds: [session.id],
          flagged,
          summary: null,
          state: "missing",
          suggested: false,
        });
      }
    }
    for (const row of byStudent.values()) {
      row.summary = summaries.find((s) => s.student_id === row.studentId) ?? null;
      row.state = summaryState(row.summary, row.sessionIds);
      row.suggested = isSuggestedForSummary(row.sessionIds.length, row.flagged);
    }
    // Needs-work first, then by name.
    const order: Record<SummaryState, number> = { outdated: 0, missing: 1, draft: 2, final: 3 };
    return [...byStudent.values()].sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name, "id"));
  }, [sessions, summaries, t.santri]);

  // Only these need an AI call; drafts that are already current and final ones do not.
  const needsWork = (row: Row) => row.state === "missing" || row.state === "outdated";
  const suggestedIds = rows.filter((row) => needsWork(row) && row.suggested).map((row) => row.studentId);
  const missingIds = rows.filter(needsWork).map((row) => row.studentId);
  const selectedCount = selected.size;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_RUN) next.add(id);
      return next;
    });
  }

  function choose(ids: string[]) {
    setSelected(new Set(ids.slice(0, MAX_PER_RUN)));
  }

  async function run() {
    setConfirmOpen(false);
    const queue = rows.filter((row) => selected.has(row.studentId));
    setRunning(true);
    setProgress(Object.fromEntries(queue.map((row) => [row.studentId, { state: "queued" as RunState }])));
    // One at a time: each is its own request, so a failure never loses the others
    // and the AI is never hit with a burst.
    for (const row of queue) {
      setProgress((current) => ({ ...current, [row.studentId]: { state: "running" } }));
      const result = await generateBpMonthlySummary(row.studentId, month, { model: selectedModel, temperature, language });
      setProgress((current) => ({
        ...current,
        [row.studentId]: result.success ? { state: result.outcome } : { state: "error", error: result.error },
      }));
    }
    setRunning(false);
    setSelected(new Set());
    setReloadKey((k) => k + 1);
  }

  const doneCount = Object.values(progress).filter((p) => p.state === "created" || p.state === "updated" || p.state === "unchanged").length;
  const failedCount = Object.values(progress).filter((p) => p.state === "error").length;
  const hasRun = Object.keys(progress).length > 0;

  const stateLabel: Record<SummaryState, { label: string; tone: string }> = {
    missing: { label: isEnglish ? "Not made" : "Belum dibuat", tone: "bg-slate-100 text-slate-500" },
    draft: { label: "Draft", tone: "bg-amber-100 text-amber-700" },
    outdated: { label: isEnglish ? "New sessions" : "Ada sesi baru", tone: "bg-sky-100 text-sky-700" },
    final: { label: "Final", tone: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <div className="min-h-screen bg-paper pb-36">
      <header className="border-b-2 border-slate-100 bg-white px-6 pb-5 pt-9" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
        <Link href="/bk/history" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" />
          {isEnglish ? "History" : "Riwayat"}
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white" style={{ boxShadow: "0 4px 0 var(--brand-700)" }}>
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling mode" : "Mode BK"}</p>
            <h1 className="text-2xl font-bold text-slate-800">{isEnglish ? "Monthly reports" : "Rapor bulanan"}</h1>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-6 pt-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {months.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={month === key}
              onClick={() => {
                setMonth(key);
                setSelected(new Set());
                setProgress({});
              }}
              disabled={running}
              className={`shrink-0 rounded-xl border-2 px-3.5 py-2 text-xs font-bold capitalize ${month === key ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-500"}`}
            >
              {monthLabel(key, locale)}
            </button>
          ))}
        </div>

        <p className="rounded-2xl bg-white px-4 py-3 text-xs font-medium leading-relaxed text-slate-500" style={{ boxShadow: "0 2px 0 #e2e8f0" }}>
          {isEnglish
            ? "A monthly report is a short summary written from this month's existing notes. It is only made when you ask, and you review it before it is final."
            : "Rapor bulanan adalah ringkasan singkat dari catatan sesi bulan ini. Hanya dibuat saat Anda memintanya, dan Anda tinjau dulu sebelum dijadikan final."}
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
          </div>
        ) : loadFailed ? (
          <div className="space-y-3 rounded-2xl border-2 border-dashed border-rose-200 px-5 py-10 text-center">
            <p className="text-sm font-bold text-slate-500">{isEnglish ? "Could not load this month." : "Bulan ini belum bisa dimuat."}</p>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white">
              {isEnglish ? "Try again" : "Coba lagi"}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-10 text-center text-sm font-bold text-slate-400">
            {isEnglish ? "No counselling sessions this month, so there is nothing to summarise." : "Tidak ada sesi bimbingan pada bulan ini, jadi belum ada yang perlu dirangkum."}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => choose(suggestedIds)} disabled={running || suggestedIds.length === 0} className="rounded-xl border-2 border-brand-200 bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand-700 disabled:opacity-40">
                {isEnglish ? `Select suggested (${suggestedIds.length})` : `Pilih yang disarankan (${suggestedIds.length})`}
              </button>
              <button type="button" onClick={() => choose(missingIds)} disabled={running || missingIds.length === 0} className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-40">
                {isEnglish ? `Select all pending (${missingIds.length})` : `Pilih semua yang belum (${missingIds.length})`}
              </button>
              {selectedCount > 0 && !running && (
                <button type="button" onClick={() => setSelected(new Set())} className="px-2 py-2 text-[11px] font-bold text-slate-400">
                  {isEnglish ? "Clear" : "Kosongkan"}
                </button>
              )}
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-slate-400">
              {isEnglish
                ? "\"Suggested\" means more than one session, or a session flagged for attention. With a single session a summary mostly repeats the note."
                : "\"Disarankan\" berarti ada lebih dari satu sesi, atau ada sesi yang ditandai perlu perhatian. Dengan satu sesi saja, ringkasan hanya mengulang catatan."}
            </p>

            <div className="space-y-2.5">
              {rows.map((row, index) => {
                const status = stateLabel[row.state];
                const run = progress[row.studentId];
                const selectable = needsWork(row) && !running;
                return (
                  <div key={row.studentId} className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-3" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.studentId)}
                      disabled={!selectable || (!selected.has(row.studentId) && selectedCount >= MAX_PER_RUN)}
                      onChange={() => toggle(row.studentId)}
                      aria-label={`${isEnglish ? "Select" : "Pilih"} ${row.name}`}
                      className="h-5 w-5 shrink-0 accent-[var(--brand-500)] disabled:opacity-30"
                    />
                    <StudentAvatar name={row.name} photoUrl={row.photoUrl} size="sm" colorIndex={index} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{row.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-slate-400">
                        <span>{row.sessionIds.length} {isEnglish ? (row.sessionIds.length === 1 ? "session" : "sessions") : "sesi"}</span>
                        {row.suggested && needsWork(row) && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">{isEnglish ? "Suggested" : "Disarankan"}</span>}
                        {row.flagged && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                            {isEnglish ? "Attention" : "Perhatian"}
                          </span>
                        )}
                      </p>
                      {run?.state === "error" && <p role="alert" className="mt-1 text-[11px] font-bold text-rose-600">{run.error}</p>}
                    </div>
                    {run ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold">
                        {run.state === "running" && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
                        {run.state === "queued" && <span className="text-slate-400">{isEnglish ? "Waiting" : "Menunggu"}</span>}
                        {(run.state === "created" || run.state === "updated" || run.state === "unchanged") && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {run.state === "error" && <XCircle className="h-4 w-4 text-rose-500" />}
                      </span>
                    ) : row.summary ? (
                      <Link href={`/bk/monthly/${row.summary.id}`} className="inline-flex shrink-0 items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${status.tone}`}>{status.label}</span>
                        <ArrowRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${status.tone}`}>{status.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {(selectedCount > 0 || hasRun) && (
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[450px] -translate-x-1/2 border-t-2 border-slate-100 bg-white p-4">
          {hasRun && !running ? (
            <p className="text-center text-sm font-bold text-slate-700">
              {isEnglish
                ? `Done: ${doneCount} created${failedCount ? `, ${failedCount} failed` : ""}.`
                : `Selesai: ${doneCount} rapor dibuat${failedCount ? `, ${failedCount} gagal` : ""}.`}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={running || selectedCount === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-sm font-bold text-white disabled:bg-slate-300"
              style={!running ? { boxShadow: "0 4px 0 var(--brand-700)" } : undefined}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {running
                ? isEnglish ? `Creating ${doneCount + failedCount + 1} of ${Object.keys(progress).length}…` : `Membuat ${doneCount + failedCount + 1} dari ${Object.keys(progress).length}…`
                : isEnglish ? `Create ${selectedCount} monthly report${selectedCount === 1 ? "" : "s"}` : `Buat ${selectedCount} rapor bulanan`}
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title={isEnglish ? `Create ${selectedCount} monthly report${selectedCount === 1 ? "" : "s"}?` : `Buat ${selectedCount} rapor bulanan?`}
        description={
          isEnglish
            ? `This makes ${selectedCount} AI request${selectedCount === 1 ? "" : "s"}, one per student, using only the notes already written. You can review and edit each one before it is final.`
            : `Ini akan memakai ${selectedCount} permintaan AI, satu per siswa, hanya dari catatan yang sudah ada. Setiap rapor dapat Anda tinjau dan ubah sebelum dijadikan final.`
        }
        confirmLabel={isEnglish ? "Create" : "Buat"}
        cancelLabel={isEnglish ? "Cancel" : "Batal"}
        confirmVariant="success"
        onConfirm={run}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
