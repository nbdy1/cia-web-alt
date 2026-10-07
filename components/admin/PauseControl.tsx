/**
 * components/admin/PauseControl.tsx
 *
 * Lets an admin ease off a requirement for a while (exams, holidays, ...):
 * pause it for a date range, or until they turn it back on. Shared by the report
 * target (/admin/monitoring) and the treatment follow-up target
 * (/admin/treatment-plans). Presentation only; saving is delegated to `onChange`.
 */
"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { addDaysToKey, isDateInPause, type DateKey, type PauseWindow } from "@/lib/requirement-rules";

export type PauseSaveResult = { success: true; pause: PauseWindow } | { success: false; error: string };

type Props = {
  pause: PauseWindow;
  /** Today's calendar day in the school's time zone. */
  today: DateKey;
  /** What is being paused, as a noun phrase, e.g. "target laporan". */
  subject: string;
  isEnglish: boolean;
  onChange: (from: DateKey | null, until: DateKey | null) => Promise<PauseSaveResult>;
};

function formatKey(key: DateKey, locale: string) {
  // Noon UTC keeps the calendar day stable in every time zone.
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

export function PauseControl({ pause, today, subject, isEnglish, onChange }: Props) {
  const locale = isEnglish ? "en-US" : "id-ID";
  const active = isDateInPause(pause, today);
  const scheduled = !!pause.from && pause.from > today;

  const [editing, setEditing] = useState(false);
  const [startMode, setStartMode] = useState<"today" | "date">("today");
  const [startDate, setStartDate] = useState(addDaysToKey(today, 1));
  const [endMode, setEndMode] = useState<"date" | "open">("date");
  const [endDate, setEndDate] = useState(addDaysToKey(today, 13));
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const from = startMode === "today" ? today : startDate;
  const invalid = endMode === "date" && (!endDate || endDate < from);

  function run(nextFrom: DateKey | null, nextUntil: DateKey | null) {
    setError("");
    startSaving(async () => {
      const result = await onChange(nextFrom, nextUntil);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function openEditor() {
    // Start from what is already set so "Ubah" edits instead of resetting.
    if (pause.from) {
      setStartMode(pause.from <= today ? "today" : "date");
      setStartDate(pause.from > today ? pause.from : addDaysToKey(today, 1));
      setEndMode(pause.until ? "date" : "open");
      setEndDate(pause.until ?? addDaysToKey(today, 13));
    }
    setError("");
    setEditing(true);
  }

  const presets = [
    { days: 7, label: isEnglish ? "1 week" : "1 minggu" },
    { days: 14, label: isEnglish ? "2 weeks" : "2 minggu" },
    { days: 30, label: isEnglish ? "1 month" : "1 bulan" },
  ];

  let summary: { tone: string; icon: React.ReactNode; title: string; detail: string } | null = null;
  if (active) {
    summary = {
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      icon: <PauseCircle size={18} className="text-amber-600" />,
      title: isEnglish ? `The ${subject} is paused` : `${subject[0].toUpperCase()}${subject.slice(1)} sedang dijeda`,
      detail: pause.until
        ? isEnglish
          ? `Nothing is due until ${formatKey(pause.until, locale)}. It resumes automatically after that.`
          : `Tidak ada tenggat sampai ${formatKey(pause.until, locale)}. Otomatis berlaku lagi setelahnya.`
        : isEnglish
          ? "Nothing is due until you turn it back on."
          : "Tidak ada tenggat sampai Anda mengaktifkannya kembali.",
    };
  } else if (scheduled && pause.from) {
    summary = {
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      icon: <CalendarClock size={18} className="text-slate-500" />,
      title: isEnglish ? "A pause is scheduled" : "Jeda sudah dijadwalkan",
      detail: pause.until
        ? isEnglish
          ? `${formatKey(pause.from, locale)} – ${formatKey(pause.until, locale)}`
          : `${formatKey(pause.from, locale)} – ${formatKey(pause.until, locale)}`
        : isEnglish
          ? `From ${formatKey(pause.from, locale)}, until you turn it back on.`
          : `Mulai ${formatKey(pause.from, locale)}, sampai Anda mengaktifkannya kembali.`,
    };
  }

  return (
    <div className="space-y-3">
      {summary ? (
        <div className={`rounded-2xl border-2 p-4 ${summary.tone}`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{summary.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold">{summary.title}</p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed opacity-80">{summary.detail}</p>
            </div>
          </div>
          {!editing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => run(null, null)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 h-9 text-xs font-bold text-slate-700 border-2 border-slate-200 hover:border-slate-300 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                {active ? (isEnglish ? "Turn back on now" : "Aktifkan kembali sekarang") : (isEnglish ? "Cancel pause" : "Batalkan jeda")}
              </button>
              <button type="button" onClick={openEditor} className="inline-flex items-center rounded-xl px-3 h-9 text-xs font-bold underline underline-offset-2">
                {isEnglish ? "Change dates" : "Ubah tanggal"}
              </button>
            </div>
          )}
        </div>
      ) : (
        !editing && (
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 h-10 text-xs font-bold text-slate-600 hover:border-slate-300"
          >
            <PauseCircle size={14} className="text-slate-400" />
            {isEnglish ? `Pause the ${subject}…` : `Jeda ${subject}…`}
          </button>
        )
      )}

      {editing && (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Starts" : "Mulai"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {(["today", "date"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={startMode === mode}
                  onClick={() => setStartMode(mode)}
                  className={`px-3 h-9 rounded-xl border-2 text-xs font-bold ${startMode === mode ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-100 text-slate-500 hover:border-slate-200"}`}
                >
                  {mode === "today" ? (isEnglish ? "Today" : "Hari ini") : (isEnglish ? "On a date" : "Pada tanggal")}
                </button>
              ))}
              {startMode === "date" && (
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 rounded-xl border-2 border-slate-200 px-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-400"
                  aria-label={isEnglish ? "Pause start date" : "Tanggal mulai jeda"}
                />
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Ends" : "Sampai"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {(["date", "open"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={endMode === mode}
                  onClick={() => setEndMode(mode)}
                  className={`px-3 h-9 rounded-xl border-2 text-xs font-bold ${endMode === mode ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-100 text-slate-500 hover:border-slate-200"}`}
                >
                  {mode === "date" ? (isEnglish ? "Until a date" : "Sampai tanggal") : (isEnglish ? "Until I turn it back on" : "Sampai saya aktifkan kembali")}
                </button>
              ))}
              {endMode === "date" && (
                <input
                  type="date"
                  value={endDate}
                  min={from}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9 rounded-xl border-2 border-slate-200 px-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-400"
                  aria-label={isEnglish ? "Pause end date" : "Tanggal selesai jeda"}
                />
              )}
            </div>
            {endMode === "date" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setEndDate(addDaysToKey(from, preset.days - 1))}
                    className="px-2.5 h-7 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-200"
                  >
                    {isEnglish ? `+ ${preset.label}` : `+ ${preset.label}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => run(from, endMode === "open" ? null : endDate)}
              disabled={saving || invalid}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-brand-500 text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400"
              style={!saving && !invalid ? { boxShadow: "0 3px 0 0 var(--brand-700)" } : undefined}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {isEnglish ? "Save pause" : "Simpan jeda"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 h-10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50">
              {isEnglish ? "Cancel" : "Batal"}
            </button>
            {invalid && (
              <span className="text-[11px] font-bold text-rose-600">
                {isEnglish ? "The end date must not be before the start." : "Tanggal selesai tidak boleh sebelum tanggal mulai."}
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs font-bold text-rose-600 leading-relaxed">{error}</p>}
    </div>
  );
}
