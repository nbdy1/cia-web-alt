/**
 * components/bk/BkMonthlySummaryActions.tsx
 *
 * The counselor's controls on a monthly report: edit the overview, add their own
 * note, mark it final (or reopen it), refresh it with the AI, and print. The AI is
 * only called by "refresh", which says so and asks first when nothing has changed.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, Pencil, Printer, RefreshCw, Save, Unlock } from "lucide-react";
import { generateBpMonthlySummary, updateBpMonthlySummary } from "@/app/actions/bp-monthly";
import { useSettings } from "@/lib/context/settings-context";
import { ConfirmModal } from "@/components/ConfirmModal";

type Props = {
  id: string;
  studentId: string;
  month: string;
  status: "draft" | "final";
  overview: string;
  teacherNote: string;
  /** Sessions added to this month after the report was generated. */
  newSessionsCount: number;
  isEnglish: boolean;
};

export function BkMonthlySummaryActions({ id, studentId, month, status, overview, teacherNote, newSessionsCount, isEnglish }: Props) {
  const router = useRouter();
  const { selectedModel, temperature, language } = useSettings();
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState(overview);
  const [noteDraft, setNoteDraft] = useState(teacherNote);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [pending, startTransition] = useTransition();
  const isFinal = status === "final";

  function save(patch: Parameters<typeof updateBpMonthlySummary>[1], doneMessage?: string) {
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await updateBpMonthlySummary(id, patch);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (doneMessage) setNotice(doneMessage);
      setEditingOverview(false);
      router.refresh();
    });
  }

  function refreshWithAi() {
    setConfirmRefresh(false);
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await generateBpMonthlySummary(studentId, month, { model: selectedModel, temperature, language, force: true });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setNotice(isEnglish ? "Report refreshed from the notes." : "Rapor diperbarui dari catatan.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border-2 border-slate-100 bg-white p-5 print:hidden" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
      <div>
        <h2 className="text-sm font-bold text-slate-800">{isEnglish ? "Your review" : "Tinjauan Anda"}</h2>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">
          {isEnglish
            ? "The summary is a draft written by AI from the session notes. Read it, adjust it, then mark it final."
            : "Ringkasan ini adalah draft yang ditulis AI dari catatan sesi. Baca, sesuaikan, lalu jadikan final."}
        </p>
      </div>

      {!isFinal && (
        <div className="space-y-2">
          {editingOverview ? (
            <>
              <textarea
                value={overviewDraft}
                onChange={(event) => setOverviewDraft(event.target.value)}
                rows={6}
                maxLength={2000}
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-brand-400"
                aria-label={isEnglish ? "Overview of the month" : "Gambaran bulan ini"}
              />
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => save({ overview: overviewDraft })} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white disabled:opacity-50">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isEnglish ? "Save overview" : "Simpan gambaran"}
                </button>
                <button type="button" onClick={() => { setOverviewDraft(overview); setEditingOverview(false); }} className="px-3 text-xs font-bold text-slate-500">
                  {isEnglish ? "Cancel" : "Batal"}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setEditingOverview(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 text-xs font-bold text-slate-600">
              <Pencil className="h-3.5 w-3.5" />
              {isEnglish ? "Edit the overview" : "Ubah gambaran bulan ini"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600" htmlFor="bk-teacher-note">
          {isEnglish ? "Your own note (optional)" : "Catatan Anda sendiri (opsional)"}
        </label>
        <textarea
          id="bk-teacher-note"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          rows={3}
          maxLength={4000}
          disabled={isFinal}
          placeholder={isEnglish ? "Anything the summary missed, or context only you know…" : "Hal yang belum tertulis, atau konteks yang hanya Anda ketahui…"}
          className="w-full resize-none rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-brand-400 disabled:bg-slate-50"
        />
        {!isFinal && noteDraft.trim() !== teacherNote.trim() && (
          <button type="button" disabled={pending} onClick={() => save({ teacherNote: noteDraft }, isEnglish ? "Note saved." : "Catatan tersimpan.")} className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />
            {isEnglish ? "Save note" : "Simpan catatan"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {isFinal ? (
          <button type="button" disabled={pending} onClick={() => save({ status: "draft" }, isEnglish ? "Reopened as a draft." : "Dibuka kembali sebagai draft.")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3.5 text-xs font-bold text-slate-600 disabled:opacity-50">
            <Unlock className="h-4 w-4" />
            {isEnglish ? "Reopen as draft" : "Buka kembali sebagai draft"}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => save({ status: "final" }, isEnglish ? "Marked final." : "Ditandai final.")} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-xs font-bold text-white disabled:opacity-50" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {isEnglish ? "Mark as final" : "Jadikan final"}
          </button>
        )}
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3.5 text-xs font-bold text-slate-600">
          <Printer className="h-4 w-4" />
          {isEnglish ? "Print" : "Cetak"}
        </button>
        {!isFinal && (
          <button type="button" disabled={pending} onClick={() => (newSessionsCount > 0 ? refreshWithAi() : setConfirmRefresh(true))} className={`inline-flex h-10 items-center gap-1.5 rounded-xl border-2 px-3.5 text-xs font-bold disabled:opacity-50 ${newSessionsCount > 0 ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600"}`}>
            <RefreshCw className="h-4 w-4" />
            {newSessionsCount > 0
              ? isEnglish ? `Update with ${newSessionsCount} new session${newSessionsCount === 1 ? "" : "s"}` : `Perbarui dengan ${newSessionsCount} sesi baru`
              : isEnglish ? "Rewrite with AI" : "Tulis ulang dengan AI"}
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </p>
      )}
      {error && <p role="alert" className="text-xs font-bold leading-relaxed text-rose-600">{error}</p>}

      <ConfirmModal
        isOpen={confirmRefresh}
        title={isEnglish ? "Rewrite this report with AI?" : "Tulis ulang rapor dengan AI?"}
        description={
          isEnglish
            ? "Nothing has changed since it was written, so this uses one more AI request for a similar result. Your own note is kept; edits to the overview will be replaced."
            : "Belum ada perubahan sejak rapor ini dibuat, jadi ini memakai satu permintaan AI lagi untuk hasil yang mirip. Catatan Anda tetap ada; perubahan pada gambaran bulan ini akan diganti."
        }
        confirmLabel={isEnglish ? "Rewrite" : "Tulis ulang"}
        cancelLabel={isEnglish ? "Cancel" : "Batal"}
        confirmVariant="success"
        onConfirm={refreshWithAi}
        onCancel={() => setConfirmRefresh(false)}
      />
    </section>
  );
}
