/**
 * components/admin/ExemptionControls.tsx
 *
 * Shared UI for exempting teachers from the report / treatment follow-up targets
 * (test accounts, people not tasked with supervising students). Two pieces:
 *   - ExcludeAction: a two-step button on a teacher card ("Kecualikan" → confirm),
 *     so a stray tap cannot silently drop someone from the targets.
 *   - ExcludedSection: the collapsible list of exempt teachers with an undo, so
 *     the exception is always visible and reversible.
 * Presentation only; saving is delegated to the callbacks, which resolve with an
 * error message (or null on success).
 */
"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, UserMinus } from "lucide-react";

type Resolve = Promise<string | null>;

export function ExcludeAction({ isEnglish, onConfirm }: { isEnglish: boolean; onConfirm: () => Resolve }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  function confirm() {
    setError("");
    startSaving(async () => {
      const message = await onConfirm();
      if (message) setError(message);
      else setAsking(false);
    });
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600"
      >
        <UserMinus size={12} />
        {isEnglish ? "Exclude from targets" : "Kecualikan dari target"}
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
        <span className="text-[11px] font-bold text-slate-600">
          {isEnglish ? "Exclude from both the report and follow-up targets?" : "Kecualikan dari target laporan & tindak lanjut?"}
        </span>
        <button
          type="button"
          onClick={confirm}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 h-7 text-[11px] font-bold text-white disabled:opacity-60"
        >
          {saving && <Loader2 size={11} className="animate-spin" />}
          {isEnglish ? "Yes, exclude" : "Ya, kecualikan"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={saving} className="px-2 h-7 text-[11px] font-bold text-slate-500">
          {isEnglish ? "Cancel" : "Batal"}
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] font-bold text-rose-600">{error}</p>}
    </div>
  );
}

export function ExcludedSection({
  teachers,
  isEnglish,
  ustadzLower,
  onRestore,
}: {
  teachers: Array<{ id: string; name: string }>;
  isEnglish: boolean;
  ustadzLower: string;
  onRestore: (id: string) => Resolve;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [, startRestoring] = useTransition();

  if (teachers.length === 0) return null;

  function restore(id: string) {
    setError("");
    setBusyId(id);
    startRestoring(async () => {
      const message = await onRestore(id);
      if (message) setError(message);
      setBusyId(null);
    });
  }

  return (
    <details className="group rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/60 px-5 py-4">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-xs font-bold text-slate-500 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <UserMinus size={14} className="text-slate-400" />
          {isEnglish ? `Excluded from targets (${teachers.length})` : `Dikecualikan dari target (${teachers.length})`}
        </span>
        <span className="text-[11px] font-bold text-brand-700 group-open:hidden">{isEnglish ? "Show" : "Lihat"}</span>
      </summary>
      <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
        {isEnglish
          ? `These ${ustadzLower}s are not judged against the report or follow-up targets and never see the reminder. Their reports are still kept.`
          : `${ustadzLower[0].toUpperCase()}${ustadzLower.slice(1)} berikut tidak dinilai terhadap target laporan maupun tindak lanjut, dan tidak melihat pengingat. Laporan mereka tetap tersimpan.`}
      </p>
      <ul className="mt-3 space-y-2">
        {teachers.map((teacher) => (
          <li key={teacher.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <span className="min-w-0 break-words text-sm font-bold text-slate-700">{teacher.name}</span>
            <button
              type="button"
              onClick={() => restore(teacher.id)}
              disabled={busyId === teacher.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-2.5 h-8 text-[11px] font-bold text-slate-600 hover:border-slate-300 disabled:opacity-60"
            >
              {busyId === teacher.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {isEnglish ? "Include again" : "Masukkan kembali"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
    </details>
  );
}
