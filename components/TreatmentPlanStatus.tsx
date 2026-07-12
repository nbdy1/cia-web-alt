/**
 * components/TreatmentPlanStatus.tsx
 *
 * Client component rendered inside the "Rencana Penanganan" section of the
 * report detail page. Lets the ustadz mark the treatment plan as done (with
 * an outcome note) or declined/not implemented (with a reason), or undo
 * either back to pending.
 */
"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { setTreatmentPlanStatus, type TreatmentPlanStatusValue } from "@/app/actions/reports";

interface Props {
  reportId: string;
  status: TreatmentPlanStatusValue;
  resolvedAt: string | null;
  outcomeNote: string | null;
}

export function TreatmentPlanStatus({ reportId, status, resolvedAt, outcomeNote }: Props) {
  const [currentStatus, setCurrentStatus] = useState<TreatmentPlanStatusValue>(status);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(outcomeNote ?? "");
  const [savedAt, setSavedAt] = useState(resolvedAt);
  const [draftAction, setDraftAction] = useState<"completed" | "declined" | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (nextStatus: "completed" | "declined") => {
    const trimmed = note.trim();
    setCurrentStatus(nextStatus);
    setSavedNote(trimmed);
    setDraftAction(null);
    startTransition(async () => {
      const result = await setTreatmentPlanStatus(reportId, nextStatus, trimmed);
      if (result.success) {
        setSavedAt(new Date().toISOString());
      } else {
        setCurrentStatus(status);
        console.error("setTreatmentPlanStatus failed:", result.error);
      }
    });
  };

  const handleUndo = () => {
    const prevStatus = currentStatus;
    setCurrentStatus("pending");
    setSavedNote("");
    setSavedAt(null);
    startTransition(async () => {
      const result = await setTreatmentPlanStatus(reportId, "pending");
      if (!result.success) {
        setCurrentStatus(prevStatus);
        console.error("setTreatmentPlanStatus failed:", result.error);
      }
    });
  };

  if (currentStatus === "completed") {
    return (
      <div className="mt-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={16} />
            <span className="text-xs font-black uppercase tracking-wider">Sudah Ditangani</span>
          </div>
          <button
            onClick={handleUndo}
            disabled={isPending}
            className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-wider flex items-center gap-1"
          >
            <RotateCcw size={11} /> Ubah
          </button>
        </div>
        {savedNote && (
          <p className="text-xs text-emerald-800 font-medium mt-2 leading-relaxed">{savedNote}</p>
        )}
        {savedAt && (
          <p className="text-[10px] text-emerald-500 font-bold mt-2">
            {new Date(savedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            {" · "}
            {new Date(savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    );
  }

  if (currentStatus === "declined") {
    return (
      <div className="mt-4 bg-rose-50 border-2 border-rose-100 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-rose-700">
            <XCircle size={16} />
            <span className="text-xs font-black uppercase tracking-wider">Tidak Diterapkan</span>
          </div>
          <button
            onClick={handleUndo}
            disabled={isPending}
            className="text-[10px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-wider flex items-center gap-1"
          >
            <RotateCcw size={11} /> Ubah
          </button>
        </div>
        {savedNote && (
          <p className="text-xs text-rose-800 font-medium mt-2 leading-relaxed">{savedNote}</p>
        )}
        {savedAt && (
          <p className="text-[10px] text-rose-500 font-bold mt-2">
            {new Date(savedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            {" · "}
            {new Date(savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    );
  }

  // Pending — show the two action buttons, and a note field once one is chosen.
  return (
    <div className="mt-4 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 space-y-3">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Status Penanganan
      </span>

      {draftAction && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={draftAction === "completed" ? "Catatan hasil penanganan (opsional)…" : "Alasan tidak diterapkan (opsional)…"}
          rows={2}
          autoFocus
          className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-brand-400 resize-none"
        />
      )}

      {draftAction === "completed" ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => submit("completed")}
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-brand-500 text-white text-xs font-black flex items-center justify-center gap-1.5 active:translate-y-px transition-all disabled:opacity-60"
            style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}
          >
            {isPending ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <CheckCircle2 size={14} className="shrink-0" />}
            Konfirmasi Selesai
          </button>
          <button
            onClick={() => setDraftAction(null)}
            className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-black"
          >
            Batal
          </button>
        </div>
      ) : draftAction === "declined" ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => submit("declined")}
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 active:translate-y-px transition-all disabled:opacity-60"
            style={{ boxShadow: "0 3px 0 0 #be123c" }}
          >
            {isPending ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <XCircle size={14} className="shrink-0" />}
            Konfirmasi Tidak Diterapkan
          </button>
          <button
            onClick={() => setDraftAction(null)}
            className="w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-black"
          >
            Batal
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => { setDraftAction("declined"); setNote(""); }}
            className="flex-1 py-3 rounded-xl bg-white border-2 border-rose-200 text-rose-600 text-xs font-black flex items-center justify-center gap-1.5 active:translate-y-px transition-all"
            style={{ boxShadow: "0 3px 0 0 #fecdd3" }}
          >
            <XCircle size={14} className="shrink-0" /> Tolak
          </button>
          <button
            onClick={() => { setDraftAction("completed"); setNote(""); }}
            className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-xs font-black flex items-center justify-center gap-1.5 active:translate-y-px transition-all"
            style={{ boxShadow: "0 3px 0 0 var(--brand-700)" }}
          >
            <CheckCircle2 size={14} className="shrink-0" /> Tandai Selesai
          </button>
        </div>
      )}
    </div>
  );
}
