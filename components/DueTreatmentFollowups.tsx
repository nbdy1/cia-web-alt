/**
 * components/DueTreatmentFollowups.tsx
 *
 * Card at the top of /students. Rule: each teacher records AT LEAST ONE
 * treatment every two weeks, on whichever student/report needs it most (see
 * getTreatmentFollowupStatus in app/actions/treatment-followups.ts).
 *
 * The card appears only once two weeks have passed without a recorded
 * treatment. The header toggles the detail panel, the chips choose which student
 * to follow up, and the panel shows the full plan plus a link to the report.
 * Recording one treatment satisfies the whole window, so the card then clears
 * (it is not a queue to work through).
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, CheckCircle2, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import {
  getTreatmentFollowupStatus,
  recordTreatmentFollowup,
  type TreatmentCandidate,
} from "@/app/actions/treatment-followups";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { showLocalNotification } from "@/lib/notify";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;

export function DueTreatmentFollowups() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";
  const [candidates, setCandidates] = useState<TreatmentCandidate[]>([]);
  const [dueSince, setDueSince] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState("");
  const [recordedName, setRecordedName] = useState<string | null>(null);
  // Captured when the data loads so "N days past" is stable across renders.
  const [loadedAt, setLoadedAt] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!activeOrganizationId) return;
    let cancelled = false;
    void getTreatmentFollowupStatus(activeOrganizationId)
      .then((status) => {
        if (cancelled || !status.isDue || status.candidates.length === 0) return;
        setCandidates(status.candidates);
        setDueSince(status.dueSince);
        setActiveId(status.candidates[0].id);
        setLoadedAt(Date.now());
        // Once per page load; switching students never re-fires it.
        void showLocalNotification("CDS", {
          body: isEnglish
            ? "No treatment recorded in the last 2 weeks. Pick a student to follow up."
            : "Belum ada treatment tercatat 2 minggu terakhir. Pilih satu anak untuk ditindaklanjuti.",
          icon: "/icon.png",
          tag: "treatment-followup-due",
          url: "/students",
        });
      })
      // A failed reminder lookup must never break the page it is embedded in.
      .catch((loadError: unknown) => console.error("Treatment follow-up load failed:", loadError));
    return () => {
      cancelled = true;
    };
    // isEnglish only affects the notification wording, not whether to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId]);

  if (recordedName) {
    return (
      <section className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4" style={{ boxShadow: "0 3px 0 #d1fae5" }}>
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-bold text-slate-800">
            {isEnglish ? `Treatment for ${recordedName} recorded. Thank you!` : `Treatment ${recordedName} tercatat. Terima kasih!`}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {isEnglish ? `Your next treatment is due within ${WINDOW_DAYS} days.` : `Treatment berikutnya dicatat paling lambat ${WINDOW_DAYS} hari lagi.`}
          </p>
        </div>
      </section>
    );
  }

  const active = candidates.find((item) => item.id === activeId) ?? null;
  if (!active) return null;

  function select(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    // A half-written note belongs to the previous student; don't carry it over.
    setReflection("");
    setError("");
  }

  function formatDate(iso: string | null) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  }

  const daysPast = dueSince ? Math.max(0, Math.floor((loadedAt - new Date(dueSince).getTime()) / DAY_MS)) : 0;
  const statusLine =
    daysPast <= 0
      ? isEnglish ? "No treatment recorded in 2 weeks" : "Belum ada treatment dalam 2 minggu"
      : isEnglish
        ? `No treatment recorded for ${WINDOW_DAYS + daysPast} days`
        : `Belum ada treatment selama ${WINDOW_DAYS + daysPast} hari`;

  function submit() {
    const chosen = active;
    if (!chosen) return;
    if (reflection.trim().length < 12) {
      setError(isEnglish ? "Add a brief note on what was done and how the student responded." : "Tuliskan sedikit apa yang dilakukan dan bagaimana responsnya.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await recordTreatmentFollowup(chosen.id, "done", reflection);
      if (!result.success) {
        setError(result.error ?? (isEnglish ? "Follow-up could not be saved." : "Tindak lanjut belum dapat disimpan."));
        return;
      }
      // One recorded treatment satisfies the whole two-week window.
      setRecordedName(chosen.studentName);
      setCandidates([]);
      setActiveId(null);
      setReflection("");
    });
  }

  const others = candidates.length - 1;

  return (
    <section className="mb-6 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4" style={{ boxShadow: "0 3px 0 #d1fae5" }}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
          <BellRing className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-700">
            {isEnglish ? "Treatment follow-up" : "Tindak lanjut treatment"}
          </span>
          <span className="mt-0.5 block text-base font-bold leading-snug text-slate-800">{statusLine}</span>
          <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-600">
            {isEnglish
              ? "Record at least one treatment every 2 weeks. Choose whichever student needs it most."
              : "Catat minimal satu treatment setiap 2 minggu. Pilih anak yang paling membutuhkan."}
          </span>
          <span className="mt-1.5 block text-[11px] font-bold text-brand-700">
            {expanded
              ? isEnglish ? "Hide details" : "Tutup detail"
              : isEnglish ? `Choose from ${candidates.length} pending plan${candidates.length === 1 ? "" : "s"}` : `Pilih dari ${candidates.length} rencana yang belum ditangani`}
          </span>
        </span>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-brand-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {others > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {isEnglish ? "Choose who to follow up" : "Pilih siapa yang ditindaklanjuti"}
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {candidates.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => select(item.id)}
                      aria-pressed={selected}
                      className={`shrink-0 rounded-xl border-2 px-3 py-2 text-left ${
                        selected ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-brand-800"
                      }`}
                    >
                      <span className="block max-w-[11rem] truncate text-xs font-bold">{item.studentName}</span>
                      <span className={`block text-[10px] font-bold ${selected ? "text-brand-100" : "text-slate-400"}`}>
                        {isEnglish ? "Report" : "Laporan"} {formatDate(item.reportCreatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border-2 border-brand-100 bg-white p-3">
            <p className="text-sm font-bold text-slate-800">
              {active.studentName} <span className="font-medium text-slate-400">— {active.title}</span>
            </p>
            {(active.priorityTheme || active.priorityIndicator) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Focus" : "Fokus penanganan"}</p>
                {active.priorityTheme && <p className="mt-0.5 text-sm font-bold text-slate-800">{active.priorityTheme}</p>}
                {active.priorityIndicator && <p className="text-xs font-medium text-slate-600">{active.priorityIndicator}</p>}
              </div>
            )}
            {active.targetSubIndicators.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Target sub-indicators" : "Sub-indikator sasaran"}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-medium leading-relaxed text-slate-700">
                  {active.targetSubIndicators.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Treatment plan" : "Rencana penanganan"}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-700">{active.actionPlan}</p>
            </div>
            {active.previousCheckins.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Earlier follow-ups" : "Tindak lanjut sebelumnya"}</p>
                <ul className="mt-1 space-y-1.5">
                  {active.previousCheckins.map((item, index) => (
                    <li key={`${item.createdAt}-${index}`} className="text-xs font-medium leading-relaxed text-slate-600">
                      <span className="font-bold text-slate-700">
                        {formatDate(item.createdAt)} · {item.outcome === "done" ? (isEnglish ? "Tried" : "Sudah dicoba") : (isEnglish ? "Not done" : "Belum dilakukan")}
                      </span>
                      {item.reflection && <span className="block">{item.reflection}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end border-t border-slate-100 pt-2 text-[11px] font-bold">
              <Link
                href={`/reports/${active.reportId}?from=${encodeURIComponent("/students")}`}
                prefetch={false}
                className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2"
              >
                {isEnglish ? "Open full report" : "Buka laporan lengkap"} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600">
              {isEnglish
                ? `What did you do for ${active.studentName} and how did the student respond?`
                : `Apa yang dilakukan untuk ${active.studentName} dan bagaimana responsnya?`}
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                rows={3}
                placeholder={isEnglish ? "Write a brief note for the next assessment…" : "Tulis catatan singkat untuk asesmen berikutnya…"}
                className="mt-1.5 w-full resize-none rounded-xl border-2 border-brand-100 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-brand-400"
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                {isEnglish ? "Recording one treatment completes your 2-week target." : "Mencatat satu treatment sudah memenuhi target 2 minggu Anda."}
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white disabled:bg-slate-300"
                style={{ boxShadow: "0 3px 0 var(--brand-700)" }}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isEnglish ? "Save" : "Simpan"}
              </button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
