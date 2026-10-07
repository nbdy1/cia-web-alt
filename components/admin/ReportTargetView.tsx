/**
 * components/admin/ReportTargetView.tsx
 *
 * Presentation for the "Target Laporan" tab of /admin/monitoring (data loading and
 * saving live in ReportTargetPanel.tsx).
 *
 * Admins define the report target — how long a cycle is, which weekday is the
 * deadline, and whether every student needs a report or each teacher just needs
 * enough reports in total — and see who has met it for the current and the last
 * cycle, down to which students are still missing a report. Everything is judged
 * here with the shared rules (lib/report-requirement-rules.ts) so a change can be
 * previewed before saving. Free of auth/server-action imports so it renders alone.
 */
"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Loader2, Minus, PauseCircle, Plus, RotateCcw, Search, Settings2, Users } from "lucide-react";
import { PauseControl, type PauseSaveResult } from "@/components/admin/PauseControl";
import { ExcludeAction, ExcludedSection } from "@/components/admin/ExemptionControls";
import {
  evaluateTeacherCycle,
  getCycles,
  type CycleEvaluation,
  type CycleStatus,
  type ReportRequirement,
  type TeacherReportInput,
} from "@/lib/report-requirement-rules";
import { dateKeyInZone, isDateInPause, type DateKey, type PauseWindow } from "@/lib/requirement-rules";

export type ReportTargetTeacher = { id: string; name: string; students: TeacherReportInput[] };
export type RequirementSaveResult = { success: true; requirement: ReportRequirement } | { success: false; error: string };

export type ReportTargetViewProps = {
  teachers: ReportTargetTeacher[];
  requirement: ReportRequirement;
  pause: PauseWindow;
  onSave: (requirement: ReportRequirement) => Promise<RequirementSaveResult>;
  onPauseChange: (from: DateKey | null, until: DateKey | null) => Promise<PauseSaveResult>;
  /** Teachers an admin excluded from the targets. */
  exemptUserIds: string[];
  /** Exempts / re-includes a teacher; resolves with an error message or null. */
  onExemptChange: (userId: string, exempt: boolean) => Promise<string | null>;
  labels: { isEnglish: boolean; ustadz: string; ustadzLower: string; santri: string; santriLower: string };
  /** Injectable clock (defaults to the current time). */
  now?: number;
};

type Filter = "all" | "complete" | "open" | "idle";
type SortKey = "attention" | "name";
type Row = ReportTargetTeacher & { result: CycleEvaluation };

const STATUS_STYLE: Record<CycleStatus, { badge: string; bar: string; dot: string }> = {
  complete: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  in_progress: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" },
  missed: { badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", dot: "bg-rose-500" },
  idle: { badge: "bg-slate-100 text-slate-500", bar: "bg-slate-300", dot: "bg-slate-300" },
};

function formatKey(key: DateKey, locale: string, withYear = false) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function weekdayName(iso: number, locale: string) {
  // 2024-01-01 was a Monday, so iso 1..7 maps to Jan 1..7.
  return new Date(Date.UTC(2024, 0, iso, 12)).toLocaleDateString(locale, { timeZone: "UTC", weekday: "long" });
}

function Stepper({ value, min, max, onChange, label, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; suffix: string }) {
  return (
    <div className="inline-flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden">
      <button type="button" aria-label={`- ${label}`} onClick={() => onChange(value - 1)} disabled={value <= min} className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-white disabled:opacity-30">
        <Minus size={16} />
      </button>
      <span className="flex items-baseline gap-1.5 px-2 min-w-[4.5rem] justify-center" aria-label={label}>
        <span className="text-xl font-bold text-slate-800">{value}</span>
        <span className="text-xs font-bold text-slate-400">{suffix}</span>
      </span>
      <button type="button" aria-label={`+ ${label}`} onClick={() => onChange(value + 1)} disabled={value >= max} className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-white disabled:opacity-30">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function ReportTargetView({ teachers: allTeachers, requirement: savedProp, pause: pauseProp, onSave, onPauseChange, exemptUserIds, onExemptChange, labels, now: nowProp }: ReportTargetViewProps) {
  const { isEnglish } = labels;
  const t = labels;
  const locale = isEnglish ? "en-US" : "id-ID";

  const [saved, setSaved] = useState<ReportRequirement>(savedProp);
  const [draft, setDraft] = useState<ReportRequirement>(savedProp);
  const [pause, setPause] = useState(pauseProp);
  const [exemptIds, setExemptIds] = useState<Set<string>>(() => new Set(exemptUserIds));
  // Exempt teachers are not judged: they leave every count and tile.
  const teachers = useMemo(() => allTeachers.filter((teacher) => !exemptIds.has(teacher.id)), [allTeachers, exemptIds]);
  const excluded = useMemo(() => allTeachers.filter((teacher) => exemptIds.has(teacher.id)), [allTeachers, exemptIds]);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [cycleView, setCycleView] = useState<"current" | "previous">("current");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [query, setQuery] = useState("");
  const [now] = useState(() => nowProp ?? Date.now());
  const [saving, startSaving] = useTransition();

  const today = dateKeyInZone(now) ?? "1970-01-01";
  const pausedToday = isDateInPause(pause, today);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const cycles = useMemo(() => getCycles(draft, today), [draft, today]);
  const viewing = cycleView === "current" ? cycles.current : cycles.previous;
  const isEnded = cycleView === "previous";
  // A cycle whose deadline fell inside a pause is excused, as is today's cycle while paused.
  const excused = isDateInPause(pause, viewing.end) || (cycleView === "current" && pausedToday);

  const rows: Row[] = useMemo(
    () => teachers.map((teacher) => ({ ...teacher, result: evaluateTeacherCycle(teacher.id, teacher.students, draft, viewing, isEnded) })),
    [teachers, draft, viewing, isEnded],
  );

  // What the saved settings would say right now, to show the effect of an unsaved change.
  const savedOpenCount = useMemo(() => {
    const savedCycles = getCycles(saved, today);
    const cycle = cycleView === "current" ? savedCycles.current : savedCycles.previous;
    return teachers.filter((teacher) => {
      const status = evaluateTeacherCycle(teacher.id, teacher.students, saved, cycle, isEnded).status;
      return status === "in_progress" || status === "missed";
    }).length;
  }, [teachers, saved, today, cycleView, isEnded]);

  const counts = useMemo(() => {
    const c = { complete: 0, open: 0, idle: 0 };
    for (const row of rows) {
      if (row.result.status === "complete") c.complete++;
      else if (row.result.status === "idle") c.idle++;
      else c.open++;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<CycleStatus, number> = { missed: 0, in_progress: 1, complete: 2, idle: 3 };
    const ratio = (row: Row) => (row.result.required > 0 ? row.result.done / row.result.required : 1);
    return rows
      .filter((row) => {
        if (filter === "complete" && row.result.status !== "complete") return false;
        if (filter === "open" && row.result.status !== "in_progress" && row.result.status !== "missed") return false;
        if (filter === "idle" && row.result.status !== "idle") return false;
        return !q || row.name.toLowerCase().includes(q);
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name, "id")
          : rank[a.result.status] - rank[b.result.status] || ratio(a) - ratio(b) || a.name.localeCompare(b.name, "id"),
      );
  }, [rows, filter, sort, query]);

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

  function update(patch: Partial<ReportRequirement>) {
    setSavedNotice(false);
    setSaveError("");
    setDraft((current) => ({ ...current, ...patch }));
  }

  function save() {
    if (!dirty) return;
    setSaveError("");
    startSaving(async () => {
      const result = await onSave(draft);
      if (!result.success) {
        setSaveError(result.error);
        return;
      }
      setSaved(result.requirement);
      setDraft(result.requirement);
      setSavedNotice(true);
    });
  }

  const weekdays = [1, 2, 3, 4, 5, 6, 7];
  const summary =
    draft.mode === "per_student"
      ? isEnglish
        ? `Every ${weekdayName(draft.deadlineWeekday, locale)}${draft.cycleWeeks > 1 ? ` (every ${draft.cycleWeeks} weeks)` : ""}, each ${t.ustadzLower} needs at least ${draft.minCount} report${draft.minCount === 1 ? "" : "s"} for every ${t.santriLower} they supervise.`
        : `Setiap hari ${weekdayName(draft.deadlineWeekday, locale)}${draft.cycleWeeks > 1 ? ` (tiap ${draft.cycleWeeks} minggu)` : ""}, setiap ${t.ustadzLower} minimal punya ${draft.minCount} laporan untuk setiap ${t.santriLower} binaannya.`
      : isEnglish
        ? `Every ${weekdayName(draft.deadlineWeekday, locale)}${draft.cycleWeeks > 1 ? ` (every ${draft.cycleWeeks} weeks)` : ""}, each ${t.ustadzLower} needs at least ${draft.minCount} report${draft.minCount === 1 ? "" : "s"} in total, for any ${t.santriLower}.`
        : `Setiap hari ${weekdayName(draft.deadlineWeekday, locale)}${draft.cycleWeeks > 1 ? ` (tiap ${draft.cycleWeeks} minggu)` : ""}, setiap ${t.ustadzLower} minimal menulis ${draft.minCount} laporan secara total, untuk ${t.santriLower} mana pun.`;

  const statusLabel = (status: CycleStatus) =>
    excused
      ? cycleView === "current" ? (isEnglish ? "Paused" : "Dijeda") : (isEnglish ? "Excused" : "Dibebaskan")
      : status === "complete" ? (isEnglish ? "Complete" : "Lengkap")
      : status === "in_progress" ? (isEnglish ? "In progress" : "Berjalan")
      : status === "missed" ? (isEnglish ? "Missed" : "Terlewat")
      : isEnglish ? "No obligation" : "Tanpa kewajiban";

  const tiles: { id: Filter; label: string; count: number; hint: string; tone: string; ring: string }[] = [
    { id: "complete", label: isEnglish ? "Complete" : "Lengkap", count: counts.complete, hint: isEnglish ? "Target reached" : "Target tercapai", tone: "text-emerald-700 bg-emerald-50 border-emerald-100", ring: "ring-emerald-300" },
    cycleView === "current"
      ? { id: "open", label: isEnglish ? "Still to do" : "Masih berjalan", count: counts.open, hint: isEnglish ? "Not complete yet" : "Belum lengkap", tone: "text-amber-700 bg-amber-50 border-amber-100", ring: "ring-amber-300" }
      : { id: "open", label: isEnglish ? "Missed" : "Terlewat", count: counts.open, hint: isEnglish ? "Deadline passed" : "Lewat tenggat", tone: "text-rose-700 bg-rose-50 border-rose-100", ring: "ring-rose-300" },
    { id: "idle", label: isEnglish ? "No obligation" : "Tanpa kewajiban", count: counts.idle, hint: isEnglish ? `No ${t.santriLower}s assigned` : `Belum punya ${t.santriLower}`, tone: "text-slate-600 bg-slate-50 border-slate-200", ring: "ring-slate-300" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Target settings ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-5" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border-2 border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <Settings2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">{isEnglish ? "Report target" : "Target laporan"}</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed mt-0.5">{summary}</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Deadline day" : "Hari tenggat"}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {weekdays.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={draft.deadlineWeekday === day}
                  onClick={() => update({ deadlineWeekday: day })}
                  className={`px-3 h-9 rounded-xl border-2 text-xs font-bold transition-colors ${draft.deadlineWeekday === day ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"}`}
                >
                  {weekdayName(day, locale)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "Repeats every" : "Berulang setiap"}</p>
              <div className="mt-1.5">
                <Stepper value={draft.cycleWeeks} min={1} max={4} onChange={(v) => update({ cycleWeeks: v })} label={isEnglish ? "weeks" : "minggu"} suffix={isEnglish ? "wk" : "minggu"} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {draft.mode === "per_student" ? (isEnglish ? `Reports per ${t.santriLower}` : `Laporan per ${t.santriLower}`) : (isEnglish ? `Reports per ${t.ustadzLower}` : `Laporan per ${t.ustadzLower}`)}
              </p>
              <div className="mt-1.5">
                <Stepper value={draft.minCount} min={1} max={50} onChange={(v) => update({ minCount: v })} label={isEnglish ? "minimum reports" : "minimal laporan"} suffix={isEnglish ? "min" : "min"} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEnglish ? "What counts" : "Yang dihitung"}</p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {([
                { id: "per_student", title: isEnglish ? `Every ${t.santriLower}` : `Setiap ${t.santriLower} binaan`, text: isEnglish ? `Each ${t.santriLower} under the ${t.ustadzLower}'s supervision needs a report.` : `Setiap ${t.santriLower} di bawah bimbingan ${t.ustadzLower} harus punya laporan.` },
                { id: "per_teacher", title: isEnglish ? `A total per ${t.ustadzLower}` : `Total per ${t.ustadzLower}`, text: isEnglish ? `The ${t.ustadzLower} chooses who; only the number of reports matters.` : `${t.ustadz} bebas memilih ${t.santriLower}, yang dihitung hanya jumlah laporan.` },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={draft.mode === option.id}
                  onClick={() => update({ mode: option.id })}
                  className={`text-left rounded-2xl border-2 p-3 transition-colors ${draft.mode === option.id ? "border-brand-400 bg-brand-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                >
                  <span className={`block text-sm font-bold ${draft.mode === option.id ? "text-brand-800" : "text-slate-700"}`}>{option.title}</span>
                  <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-slate-500">{option.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {dirty && (
          <div className="mt-4 rounded-2xl bg-amber-50 border-2 border-amber-100 px-4 py-3 text-xs font-bold text-amber-800 leading-relaxed">
            {isEnglish
              ? `Preview: with these settings ${counts.open} ${t.ustadzLower}${counts.open === 1 ? " is" : "s are"} not complete in this cycle (now ${savedOpenCount}). Nothing changes until you save.`
              : `Pratinjau: dengan pengaturan ini ${counts.open} ${t.ustadzLower} belum lengkap pada siklus ini (sekarang ${savedOpenCount}). Belum ada yang berubah sebelum disimpan.`}
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
            <button type="button" onClick={() => { setDraft(saved); setSaveError(""); }} className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50">
              <RotateCcw size={13} /> {isEnglish ? "Undo" : "Batalkan"}
            </button>
          )}
          {savedNotice && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={13} /> {isEnglish ? "Saved. The new target applies to everyone." : "Tersimpan. Target baru berlaku untuk semua."}
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
        subject={isEnglish ? "report target" : "target laporan"}
        onChange={async (from, until) => {
          const result = await onPauseChange(from, until);
          if (result.success) setPause(result.pause);
          return result;
        }}
      />

      {/* ── Cycle switcher ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-fit" role="tablist">
          {([
            { id: "current", label: isEnglish ? "This cycle" : "Siklus ini" },
            { id: "previous", label: isEnglish ? "Last cycle" : "Siklus lalu" },
          ] as const).map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={cycleView === option.id}
              onClick={() => setCycleView(option.id)}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${cycleView === option.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-slate-500">
          {formatKey(viewing.start, locale)} – {formatKey(viewing.end, locale, true)}
          {cycleView === "current" && (
            <span className="ml-2 text-slate-400">
              {cycles.current.daysLeft === 0
                ? isEnglish ? "· deadline today" : "· tenggat hari ini"
                : isEnglish ? `· ${cycles.current.daysLeft} day${cycles.current.daysLeft === 1 ? "" : "s"} left` : `· sisa ${cycles.current.daysLeft} hari`}
            </span>
          )}
          {excused && <span className="ml-2 text-amber-600">{cycleView === "current" ? (isEnglish ? "· paused, nothing is due" : "· dijeda, tidak ada tenggat") : (isEnglish ? "· excused (pause)" : "· dibebaskan (jeda)")}</span>}
        </p>
      </div>

      {/* ── Summary tiles (also filters) ─────────────────────────────────── */}
      {!excused && (
        <div className="grid grid-cols-3 gap-2.5">
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
      )}

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
            { id: "attention", label: isEnglish ? "Needs attention" : "Perlu perhatian" },
            { id: "name", label: isEnglish ? "Name" : "Nama" },
          ] as { id: SortKey; label: string }[]).map((option) => (
            <button key={option.id} type="button" onClick={() => setSort(option.id)} className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${sort === option.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filter !== "all" && !excused && (
        <button type="button" onClick={() => setFilter("all")} className="text-[11px] font-bold text-brand-700 underline underline-offset-2">
          {isEnglish ? `Showing ${visible.length} of ${rows.length} — show everyone` : `Menampilkan ${visible.length} dari ${rows.length} — tampilkan semua`}
        </button>
      )}

      {/* ── Teachers ─────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-[1.5rem] border-2 border-dashed border-slate-200">
          <Users className="w-8 h-8 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 font-bold text-sm">
            {query || filter !== "all" ? (isEnglish ? "No matching results" : "Tidak ada hasil") : (isEnglish ? `No ${t.ustadzLower}s yet` : `Belum ada ${t.ustadzLower}`)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const style = STATUS_STYLE[row.result.status];
            const progress = row.result.required > 0 ? Math.min(100, Math.round((row.result.done / row.result.required) * 100)) : 0;
            const perTeacher = draft.mode === "per_teacher";
            const missingCount = row.result.missing.length;
            return (
              <article key={row.id} className="bg-white rounded-[1.5rem] border-2 border-slate-100 p-4 sm:p-5" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl bg-brand-50 border-2 border-brand-100 text-brand-700 font-bold flex items-center justify-center shrink-0">
                      {row.name.trim().charAt(0).toUpperCase() || "?"}
                      <span className={`absolute -right-1 -bottom-1 w-3 h-3 rounded-full border-2 border-white ${excused ? "bg-slate-300" : style.dot}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm leading-snug break-words">{row.name}</p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {row.students.filter((s) => !s.isCross).length} {t.santriLower}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${excused ? "bg-slate-100 text-slate-500" : style.badge}`}>
                    {excused ? <PauseCircle size={10} /> : row.result.status === "missed" ? <AlertTriangle size={10} /> : row.result.status === "complete" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {statusLabel(row.result.status)}
                  </span>
                </div>

                {row.result.status !== "idle" && (
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <div className={`h-full rounded-full transition-all ${excused ? "bg-slate-300" : style.bar}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className={`mt-1.5 text-[11px] font-bold ${!excused && row.result.status === "missed" ? "text-rose-600" : "text-slate-500"}`}>
                      {perTeacher
                        ? isEnglish ? `${row.result.done} of at least ${row.result.required} reports` : `${row.result.done} dari minimal ${row.result.required} laporan`
                        : isEnglish ? `${row.result.done} of ${row.result.required} ${t.santriLower}s have a report` : `${row.result.done} dari ${row.result.required} ${t.santriLower} sudah dilaporkan`}
                    </p>
                  </div>
                )}

                {!perTeacher && missingCount > 0 && (
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-bold text-brand-700 [&::-webkit-details-marker]:hidden">
                      <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                      {isEnglish ? `${missingCount} ${t.santriLower}${missingCount === 1 ? "" : "s"} still need a report` : `${missingCount} ${t.santriLower} belum dilaporkan`}
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {row.result.missing.map((student) => (
                        <li key={student.id} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          {student.name}
                          {draft.minCount > 1 && <span className="ml-1 text-slate-400">({student.count}/{draft.minCount})</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <ExcludeAction isEnglish={isEnglish} onConfirm={() => changeExempt(row.id, true)} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ExcludedSection
        teachers={excluded.map((teacher) => ({ id: teacher.id, name: teacher.name }))}
        isEnglish={isEnglish}
        ustadzLower={t.ustadzLower}
        onRestore={(id) => changeExempt(id, false)}
      />
    </div>
  );
}
