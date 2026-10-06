/**
 * components/DueTreatmentFollowups.tsx
 *
 * Card at the top of /students listing every treatment follow-up that is due for
 * the signed-in teacher. A reminder exists per report that has a treatment plan
 * (due 14 days after the report, see scripts/migrations/20260921_cds_treatment_followups.sql),
 * so a teacher can have several due at once.
 *
 * The teacher chooses which student to follow up first: the header toggles the
 * detail panel, the chips switch between due reminders, and the panel shows the
 * full plan plus a link to the whole report. Recording a follow-up removes that
 * reminder and moves to the next one.
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import {
  getDueTreatmentFollowups,
  recordTreatmentFollowup,
  type DueTreatmentFollowup,
} from "@/app/actions/treatment-followups";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";
import { showLocalNotification } from "@/lib/notify";

const DAY_MS = 86_400_000;

export function DueTreatmentFollowups() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";
  const [reminders, setReminders] = useState<DueTreatmentFollowup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Captured when the data loads so "overdue by N days" is stable across renders.
  const [loadedAt, setLoadedAt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [outcome, setOutcome] = useState<"done" | "not_done" | null>(null);
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!activeOrganizationId) return;
    let cancelled = false;
    void getDueTreatmentFollowups(activeOrganizationId)
      .then((items) => {
        if (cancelled) return;
        setReminders(items);
        setActiveId(items[0]?.id ?? null);
        setLoadedAt(Date.now());
        if (items.length === 0) return;
        // Once per page load. Deliberately not tied to the selected reminder, so
        // switching students never re-fires a system notification.
        void showLocalNotification("CDS", {
          body:
            items.length > 1
              ? isEnglish
                ? `${items.length} treatment follow-ups are due.`
                : `${items.length} tindak lanjut treatment sudah jatuh tempo.`
              : isEnglish
                ? `Time to record ${items[0].studentName}'s treatment follow-up.`
                : `Saatnya mencatat tindak lanjut treatment ${items[0].studentName}.`,
          icon: "/icon.png",
          tag: "treatment-followup-due",
          url: "/students",
        });
      })
      // A failed reminder lookup must never break the page it is embedded in.
      .catch((loadError) => console.error("Treatment follow-up load failed:", loadError));
    return () => {
      cancelled = true;
    };
    // isEnglish only affects the notification wording, not whether to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId]);

  const active = reminders.find((item) => item.id === activeId) ?? null;
  if (!active) return null;

  function select(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    // A half-written note belongs to the previous student; don't carry it over.
    setOutcome(null);
    setReflection("");
    setError("");
  }

  function dueLabel(nextCheckAt: string) {
    const days = Math.floor((loadedAt - new Date(nextCheckAt).getTime()) / DAY_MS);
    if (days <= 0) return isEnglish ? "Due today" : "Jatuh tempo hari ini";
    return isEnglish ? `Overdue ${days} day${days === 1 ? "" : "s"}` : `Terlambat ${days} hari`;
  }

  function formatDate(iso: string | null) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  }

  function submit() {
    const reminder = active;
    if (!reminder) return;
    if (!outcome || reflection.trim().length < 12) {
      setError(isEnglish ? "Choose a status and add a brief observation or reason." : "Pilih status dan tuliskan sedikit hasil pengamatan atau alasan.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await recordTreatmentFollowup(reminder.id, outcome, reflection);
      if (!result.success) {
        setError(result.error ?? (isEnglish ? "Follow-up could not be saved." : "Tindak lanjut belum dapat disimpan."));
        return;
      }
      const remaining = reminders.filter((item) => item.id !== reminder.id);
      setReminders(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setOutcome(null);
      setReflection("");
    });
  }

  const others = reminders.length - 1;

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
            {reminders.length > 1 && ` · ${reminders.length} ${isEnglish ? "due" : "jatuh tempo"}`}
          </span>
          <span className="mt-0.5 block truncate text-base font-bold text-slate-800">
            {active.studentName} — {active.title}
          </span>
          {!expanded && active.actionPlan && (
            <span className="mt-1 line-clamp-2 block text-xs font-medium leading-relaxed text-slate-600">{active.actionPlan}</span>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-brand-700">
            <span>{dueLabel(active.nextCheckAt)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {expanded
                ? isEnglish ? "Hide details" : "Tutup detail"
                : others > 0
                  ? isEnglish ? `View details · ${others} more` : `Lihat detail · ${others} lainnya`
                  : isEnglish ? "View details" : "Lihat detail"}
            </span>
          </span>
        </span>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-brand-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {reminders.length > 1 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {isEnglish ? "Choose who to follow up" : "Pilih siapa yang ditindaklanjuti"}
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {reminders.map((item) => {
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
                        {dueLabel(item.nextCheckAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border-2 border-brand-100 bg-white p-3">
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
              <p className="mt-0.5 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-700">
                {active.actionPlan || (isEnglish ? "No plan text was saved for this report." : "Teks rencana tidak tersimpan pada laporan ini.")}
              </p>
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400">
              <span>
                {isEnglish ? "Report written" : "Laporan dibuat"} {formatDate(active.reportCreatedAt)}
              </span>
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
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOutcome("done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-bold ${outcome === "done" ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-brand-700"}`}>
                {isEnglish ? "Treatment was tried" : "Treatment sudah dicoba"}
              </button>
              <button type="button" onClick={() => setOutcome("not_done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-bold ${outcome === "not_done" ? "border-slate-600 bg-slate-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                {isEnglish ? "Not done yet" : "Belum dilakukan"}
              </button>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-600">
              {outcome === "done"
                ? (isEnglish ? "What was done and how did the student respond?" : "Apa yang dilakukan dan bagaimana respons siswa?")
                : (isEnglish ? "What prevented it from being done?" : "Apa yang membuat treatment belum dilakukan?")}
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
                {isEnglish ? "A missed plan will be reminded again in two days." : "Treatment yang belum dilakukan akan diingatkan kembali dua hari lagi."}
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
