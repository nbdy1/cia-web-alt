/**
 * components/admin/TeacherComplianceView.tsx
 *
 * Presentation for the "Kepatuhan Guru" tab of /admin/treatment-plans (data
 * loading lives in TeacherCompliancePanel.tsx).
 *
 * Admins set how often every teacher must record at least one treatment (N days)
 * and see who has met it. The server sends raw facts per teacher; the status is
 * classified here with the same shared rules the teacher-side reminder uses, so
 * moving the number previews the result instantly and only Save persists it.
 * Deliberately free of auth/server-action imports so it renders in isolation.
 */
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Minus,
  PauseCircle,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import type { TeacherCompliance } from "@/app/actions/treatment-followups";
import { PauseControl, type PauseSaveResult } from "@/components/admin/PauseControl";
import { ExcludeAction, ExcludedSection } from "@/components/admin/ExemptionControls";
import { dateKeyInZone, isDateInPause, pauseRestartAt, type DateKey, type PauseWindow } from "@/lib/requirement-rules";
import {
  MAX_TREATMENT_WINDOW_DAYS,
  MIN_TREATMENT_WINDOW_DAYS,
  classifyTeacherWindow,
  normalizeWindowDays,
  type TeacherWindowResult,
  type TeacherWindowState,
} from "@/lib/treatment-followup-rules";

const DAY_MS = 86_400_000;
const PRESETS = [7, 14, 21, 30];

type Filter = "all" | "overdue" | "met" | "waiting";
type SortKey = "urgency" | "name" | "recent";
type Row = TeacherCompliance & { verdict: TeacherWindowResult };

const STATE_STYLE: Record<TeacherWindowState, { badge: string; bar: string; dot: string }> = {
  overdue: { badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", dot: "bg-rose-500" },
  met: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  grace: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" },
  idle: { badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300", dot: "bg-slate-300" },
};

export type SaveResult = { success: true; windowDays: number } | { success: false; error: string };

export type TeacherComplianceViewProps = {
  teachers: TeacherCompliance[];
  /** The currently stored target, in days. */
  savedDays: number;
  /** Persists a new target; resolves with the stored value or an error message. */
  onSave: (days: number) => Promise<SaveResult>;
  onOverdueCount?: (count: number) => void;
  /** Admin-granted pause on this requirement (from === null means none). */
  pause: PauseWindow;
  onPauseChange: (from: DateKey | null, until: DateKey | null) => Promise<PauseSaveResult>;
  /** Exempts / re-includes a teacher; resolves with an error message or null. */
  onExemptChange: (userId: string, exempt: boolean) => Promise<string | null>;
  /** Display wording, resolved by the caller from the organization's terminology. */
  labels: { isEnglish: boolean; ustadz: string; ustadzLower: string; santriLower: string };
  /** Injectable clock (defaults to the current time). */
  now?: number;
};

/** Pure presentation + local what-if state; no data fetching, so it renders in isolation. */
export function TeacherComplianceView({ teachers, savedDays: savedDaysProp, onSave, onOverdueCount, pause: pauseProp, onPauseChange, onExemptChange, labels, now: nowProp }: TeacherComplianceViewProps) {
  const { isEnglish } = labels;
  const t = labels;
  const locale = isEnglish ? "en-US" : "id-ID";

  const [savedDays, setSavedDays] = useState(savedDaysProp);
  const [draftDays, setDraftDays] = useState(savedDaysProp);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("urgency");
  const [query, setQuery] = useState("");
  // Fixed per mount so every row is judged against the same instant.
  const [now] = useState(() => nowProp ?? Date.now());
  const [saving, startSaving] = useTransition();
  const [pause, setPause] = useState(pauseProp);
  const [exemptIds, setExemptIds] = useState<Set<string>>(() => new Set(teachers.filter((teacher) => teacher.exempt).map((teacher) => teacher.userId)));
  // Exempt teachers are not judged: they leave every count, tile and the badge.
  const judged = useMemo(() => teachers.filter((teacher) => !exemptIds.has(teacher.userId)), [teachers, exemptIds]);
  const excluded = useMemo(() => teachers.filter((teacher) => exemptIds.has(teacher.userId)), [teachers, exemptIds]);

  async function changeExempt(userId: string, exempt: boolean): Promise<string | null> {
    const message = await onExemptChange(userId, exempt);
    if (message) return message;
    setExemptIds((current) => {
      const next = new Set(current);
      if (exempt) next.add(userId);
      else next.delete(userId);
      return next;
    });
    return null;
  }
  const today = dateKeyInZone(now) ?? "1970-01-01";
  const paused = isDateInPause(pause, today);
  // A pause that has ended restarts everyone's clock instead of leaving them overdue.
  const restartAt = pauseRestartAt(pause, now);

  const classify = useCallback(
    (days: number): Row[] =>
      judged.map((teacher) => ({
        ...teacher,
        verdict: classifyTeacherWindow({
          lastDoneAt: teacher.lastDoneAt,
          oldestPendingAt: teacher.oldestPendingAt,
          pendingCount: teacher.pendingCount,
          windowDays: days,
          restartAt,
          now,
        }),
      })),
    [judged, now, restartAt],
  );

  const rows = useMemo(() => classify(draftDays), [classify, draftDays]);
  const savedOverdue = useMemo(() => classify(savedDays).filter((r) => r.verdict.state === "overdue").length, [classify, savedDays]);

  const counts = useMemo(() => {
    const c = { overdue: 0, met: 0, waiting: 0 };
    for (const row of rows) {
      if (row.verdict.state === "overdue") c.overdue++;
      else if (row.verdict.state === "met") c.met++;
      else c.waiting++;
    }
    return c;
  }, [rows]);

  const draftOverdue = counts.overdue;

  // Tell the page how many teachers are currently behind, for the tab badge.
  useEffect(() => {
    onOverdueCount?.(paused ? 0 : savedOverdue);
  }, [paused, savedOverdue, onOverdueCount]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const urgencyRank: Record<TeacherWindowState, number> = { overdue: 0, grace: 1, met: 2, idle: 3 };
    return rows
      .filter((row) => {
        if (filter === "overdue" && row.verdict.state !== "overdue") return false;
        if (filter === "met" && row.verdict.state !== "met") return false;
        if (filter === "waiting" && row.verdict.state !== "grace" && row.verdict.state !== "idle") return false;
        return !q || row.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "recent") return (b.lastDoneAt ?? "").localeCompare(a.lastDoneAt ?? "") || a.name.localeCompare(b.name);
        return (
          urgencyRank[a.verdict.state] - urgencyRank[b.verdict.state] ||
          b.verdict.daysOverdue - a.verdict.daysOverdue ||
          a.name.localeCompare(b.name)
        );
      });
  }, [rows, filter, sort, query]);

  const dirty = draftDays !== savedDays;

  function setDraft(value: number) {
    setSavedNotice(false);
    setSaveError("");
    setDraftDays(normalizeWindowDays(value));
  }

  function save() {
    if (!dirty) return;
    setSaveError("");
    startSaving(async () => {
      const result = await onSave(draftDays);
      if (!result.success) {
        setSaveError(result.error);
        return;
      }
      setSavedDays(result.windowDays);
      setDraftDays(result.windowDays);
      setSavedNotice(true);
    });
  }

  function formatDate(iso: string | null) {
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  }

  function daysAgo(iso: string | null) {
    if (!iso) return "";
    const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
    if (days === 0) return isEnglish ? "today" : "hari ini";
    return isEnglish ? `${days} day${days === 1 ? "" : "s"} ago` : `${days} hari lalu`;
  }

  const stateLabel: Record<TeacherWindowState, string> = {
    overdue: isEnglish ? "Not met" : "Belum memenuhi",
    met: isEnglish ? "Met" : "Sudah memenuhi",
    grace: isEnglish ? "Not yet required" : "Belum wajib",
    idle: isEnglish ? "Nothing pending" : "Tidak ada rencana",
  };

  const tiles: { id: Filter; label: string; count: number; hint: string; tone: string; ring: string }[] = [
    { id: "overdue", label: isEnglish ? "Not met" : "Belum memenuhi", count: counts.overdue, hint: isEnglish ? "Past the deadline" : "Lewat tenggat", tone: "text-rose-700 bg-rose-50 border-rose-100", ring: "ring-rose-300" },
    { id: "met", label: isEnglish ? "Met" : "Sudah memenuhi", count: counts.met, hint: isEnglish ? "Recorded in time" : "Mencatat tepat waktu", tone: "text-emerald-700 bg-emerald-50 border-emerald-100", ring: "ring-emerald-300" },
    { id: "waiting", label: isEnglish ? "Not required yet" : "Belum wajib", count: counts.waiting, hint: isEnglish ? "New or nothing pending" : "Baru / tanpa rencana", tone: "text-slate-600 bg-slate-50 border-slate-200", ring: "ring-slate-300" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Setting ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-5" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border-2 border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <Settings2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{isEnglish ? "Follow-up target" : "Target tindak lanjut"}</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed mt-0.5">
              {isEnglish
                ? `Every ${t.ustadzLower} must record at least one treatment within this many days, for any ${t.santriLower} they choose.`
                : `Setiap ${t.ustadzLower} wajib mencatat minimal satu treatment dalam rentang hari ini, untuk ${t.santriLower} mana pun yang mereka pilih.`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden">
            <button
              type="button"
              aria-label={isEnglish ? "One day less" : "Kurangi satu hari"}
              onClick={() => setDraft(draftDays - 1)}
              disabled={draftDays <= MIN_TREATMENT_WINDOW_DAYS}
              className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-white disabled:opacity-30"
            >
              <Minus size={16} />
            </button>
            <label className="flex items-baseline gap-1.5 px-2">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_TREATMENT_WINDOW_DAYS}
                max={MAX_TREATMENT_WINDOW_DAYS}
                value={draftDays}
                onChange={(event) => setDraft(Number(event.target.value))}
                className="w-12 bg-transparent text-center text-xl font-bold text-slate-800 focus:outline-none"
                aria-label={isEnglish ? "Days between required treatments" : "Jumlah hari antar treatment wajib"}
              />
              <span className="text-xs font-bold text-slate-400">{isEnglish ? "days" : "hari"}</span>
            </label>
            <button
              type="button"
              aria-label={isEnglish ? "One day more" : "Tambah satu hari"}
              onClick={() => setDraft(draftDays + 1)}
              disabled={draftDays >= MAX_TREATMENT_WINDOW_DAYS}
              className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-white disabled:opacity-30"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDraft(days)}
                aria-pressed={draftDays === days}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold border-2 transition-colors ${
                  draftDays === days ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                }`}
              >
                {days === 7 ? (isEnglish ? "1 week" : "1 minggu") : days === 14 ? (isEnglish ? "2 weeks" : "2 minggu") : days === 21 ? (isEnglish ? "3 weeks" : "3 minggu") : (isEnglish ? "1 month" : "1 bulan")}
              </button>
            ))}
          </div>
        </div>

        {dirty && (
          <div className="mt-4 rounded-2xl bg-amber-50 border-2 border-amber-100 px-4 py-3 text-xs font-bold text-amber-800 leading-relaxed">
            {isEnglish
              ? `Preview: with ${draftDays} days, ${draftOverdue} ${t.ustadzLower}${draftOverdue === 1 ? "" : "s"} would be behind (now ${savedOverdue}). Nothing changes until you save.`
              : `Pratinjau: dengan ${draftDays} hari, ${draftOverdue} ${t.ustadzLower} belum memenuhi (sekarang ${savedOverdue}). Belum ada yang berubah sebelum disimpan.`}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-brand-500 text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            style={dirty && !saving ? { boxShadow: "0 3px 0 0 var(--brand-700)" } : undefined}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isEnglish ? "Save target" : "Simpan target"}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(savedDays)}
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw size={13} /> {isEnglish ? "Undo" : "Batalkan"}
            </button>
          )}
          {savedNotice && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={13} />
              {isEnglish ? `Saved. The target is now ${savedDays} days for everyone.` : `Tersimpan. Target sekarang ${savedDays} hari untuk semua.`}
            </span>
          )}
        </div>
        {saveError && <p role="alert" className="mt-3 text-xs font-bold text-rose-600 leading-relaxed">{saveError}</p>}
      </section>

      {/* ── Pause ─────────────────────────────────────────────────────────── */}
      <PauseControl
        pause={pause}
        today={today}
        isEnglish={isEnglish}
        subject={isEnglish ? "follow-up target" : "target tindak lanjut"}
        onChange={async (from, until) => {
          const result = await onPauseChange(from, until);
          if (result.success) setPause(result.pause);
          return result;
        }}
      />

      {/* ── Summary tiles (also filters) ─────────────────────────────────── */}
      <div className={paused ? "hidden" : "grid grid-cols-3 gap-2.5"}>
        {tiles.map((tile) => {
          const selected = filter === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setFilter(selected ? "all" : tile.id)}
              aria-pressed={selected}
              className={`text-left rounded-2xl border-2 p-3 sm:p-4 transition-all ${tile.tone} ${selected ? `ring-2 ${tile.ring}` : "hover:brightness-[0.98]"}`}
            >
              <span className="block text-2xl sm:text-3xl font-bold leading-none">{tile.count}</span>
              <span className="block mt-1.5 text-[11px] sm:text-xs font-bold leading-tight">{tile.label}</span>
              <span className="hidden sm:block mt-0.5 text-[10px] font-semibold opacity-70">{tile.hint}</span>
            </button>
          );
        })}
      </div>

      {/* ── Search + sort ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isEnglish ? `Search ${t.ustadzLower} name…` : `Cari nama ${t.ustadzLower}…`}
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-brand-400 transition-all"
            style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 overflow-x-auto">
          {([
            { id: "urgency", label: isEnglish ? "Most behind" : "Paling terlambat" },
            { id: "recent", label: isEnglish ? "Last recorded" : "Terakhir mencatat" },
            { id: "name", label: isEnglish ? "Name" : "Nama" },
          ] as { id: SortKey; label: string }[]).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSort(option.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                sort === option.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filter !== "all" && (
        <button type="button" onClick={() => setFilter("all")} className="text-[11px] font-bold text-brand-700 underline underline-offset-2">
          {isEnglish ? `Showing ${visible.length} of ${rows.length} — show everyone` : `Menampilkan ${visible.length} dari ${rows.length} — tampilkan semua`}
        </button>
      )}

      {/* ── Teachers ─────────────────────────────────────────────────────── */}
      {!paused && visible.length > 0 && (
        <p className="text-[11px] font-medium leading-relaxed text-slate-400">
          {isEnglish
            ? "The bar shows how much of the window has passed since the last recorded treatment. It is full and red once the deadline has passed."
            : "Bar menunjukkan seberapa jauh waktu berjalan sejak treatment terakhir dicatat. Bar penuh dan merah artinya sudah lewat tenggat."}
        </p>
      )}
      {visible.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <Users className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-bold text-sm">
            {query || filter !== "all"
              ? isEnglish ? "No matching results" : "Tidak ada hasil"
              : isEnglish ? `No ${t.ustadzLower}s yet` : `Belum ada ${t.ustadzLower}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const style = STATE_STYLE[row.verdict.state];
            // How much of the window has gone by: 0% right after a treatment, 100% at the deadline.
            const span = draftDays * DAY_MS;
            const dueTime = row.verdict.dueAt ? new Date(row.verdict.dueAt).getTime() : null;
            const progress =
              row.verdict.state === "overdue" ? 100
              : row.verdict.state === "idle" || dueTime === null ? 0
              : Math.min(100, Math.max(0, Math.round(((now - (dueTime - span)) / span) * 100)));

            let deadline = "";
            if (row.verdict.state === "overdue") {
              deadline = isEnglish
                ? `${row.verdict.daysOverdue} day${row.verdict.daysOverdue === 1 ? "" : "s"} past the deadline (${formatDate(row.verdict.dueAt)})`
                : `Lewat ${row.verdict.daysOverdue} hari dari tenggat (${formatDate(row.verdict.dueAt)})`;
            } else if (row.verdict.state === "met" || row.verdict.state === "grace") {
              deadline = isEnglish
                ? `Next due ${formatDate(row.verdict.dueAt)} · ${row.verdict.daysLeft} day${row.verdict.daysLeft === 1 ? "" : "s"} left`
                : `Tenggat berikutnya ${formatDate(row.verdict.dueAt)} · sisa ${row.verdict.daysLeft} hari`;
            }

            return (
              <article
                key={row.userId}
                className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-4 sm:p-5"
                style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl bg-brand-50 border-2 border-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                      {row.name.trim().charAt(0).toUpperCase() || "?"}
                      <span className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full border-2 border-white ${paused ? "bg-slate-300" : style.dot}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm leading-snug break-words">{row.name}</p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {row.pendingCount > 0
                          ? isEnglish ? `${row.pendingCount} plan${row.pendingCount === 1 ? "" : "s"} waiting` : `${row.pendingCount} rencana menunggu`
                          : isEnglish ? "No plans waiting" : "Tidak ada rencana menunggu"}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${paused ? "bg-slate-100 text-slate-500" : style.badge}`}>
                    {paused ? <PauseCircle size={10} /> : row.verdict.state === "overdue" ? <AlertTriangle size={10} /> : row.verdict.state === "met" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {paused ? (isEnglish ? "Paused" : "Dijeda") : stateLabel[row.verdict.state]}
                  </span>
                </div>

                {!paused && row.verdict.state !== "idle" && (
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className={`mt-1.5 text-[11px] font-bold ${row.verdict.state === "overdue" ? "text-rose-600" : "text-slate-500"}`}>{deadline}</p>
                  </div>
                )}

                <p className="mt-2.5 text-xs font-medium text-slate-500 leading-relaxed">
                  {row.lastDoneAt ? (
                    <>
                      {isEnglish ? "Last recorded " : "Terakhir mencatat "}
                      <span className="font-bold text-slate-700">{formatDate(row.lastDoneAt)}</span> ({daysAgo(row.lastDoneAt)})
                      {row.lastDoneStudent && <> {isEnglish ? "for " : "untuk "}<span className="font-bold text-slate-700">{row.lastDoneStudent}</span></>}
                      {" · "}
                      {isEnglish ? `${row.totalDone} in total` : `${row.totalDone} total`}
                    </>
                  ) : (
                    isEnglish ? "Has not recorded a treatment yet" : "Belum pernah mencatat treatment"
                  )}
                </p>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ExcludeAction isEnglish={isEnglish} onConfirm={() => changeExempt(row.userId, true)} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ExcludedSection
        teachers={excluded.map((teacher) => ({ id: teacher.userId, name: teacher.name }))}
        isEnglish={isEnglish}
        ustadzLower={t.ustadzLower}
        onRestore={(id) => changeExempt(id, false)}
      />
    </div>
  );
}
