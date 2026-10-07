/**
 * lib/treatment-followup-rules.ts
 *
 * Pure decision logic for the "record at least one treatment every N days" rule
 * (N is set per organization by admins on /admin/treatment-plans). Kept free of
 * database code so the teacher-side reminder (app/actions/treatment-followups.ts)
 * and the admin compliance view (re-evaluated live in the browser while the admin
 * adjusts N) share one definition, and so it can be unit tested
 * (tests/treatment-followup-rules.test.ts).
 */
export const DEFAULT_TREATMENT_WINDOW_DAYS = 14;
export const MIN_TREATMENT_WINDOW_DAYS = 1;
export const MAX_TREATMENT_WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

/** Coerces anything (null, "21", 500, NaN) into a valid whole number of days. */
export function normalizeWindowDays(value: unknown): number {
  // Number(null) and Number("") are 0, which would clamp to 1 day instead of the default.
  if (value === null || value === undefined || value === "") return DEFAULT_TREATMENT_WINDOW_DAYS;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_TREATMENT_WINDOW_DAYS;
  return Math.min(MAX_TREATMENT_WINDOW_DAYS, Math.max(MIN_TREATMENT_WINDOW_DAYS, parsed));
}

function toTime(value: string | null | undefined): number | null {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function latestIso(values: Array<string | null | undefined>): string | null {
  let best: number | null = null;
  for (const value of values) {
    const time = toTime(value);
    if (time !== null && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

/**
 * met      – recorded a treatment within the window
 * overdue  – window lapsed and there is still a pending plan to act on
 * grace    – no recorded treatment yet, but the clock (oldest pending plan, or the end of a
 *             pause) is still younger than the window
 * idle     – nothing to do (no pending plan) and no recent treatment
 */
export type TeacherWindowState = "met" | "overdue" | "grace" | "idle";

export type TeacherWindowInput = {
  lastDoneAt: string | null;
  oldestPendingAt: string | null;
  pendingCount: number;
  windowDays: number;
  /**
   * When an admin pause ended (see pauseRestartAt). The clock restarts here, so
   * teachers are not instantly overdue after a break the admin granted them.
   */
  restartAt?: string | null;
  now?: number;
};

export type TeacherWindowResult = {
  state: TeacherWindowState;
  /** When the next treatment is (or was) due; null for "idle". */
  dueAt: string | null;
  /** Whole days past dueAt (overdue only). */
  daysOverdue: number;
  /** Whole days left until dueAt (met/grace only). */
  daysLeft: number;
};

export function classifyTeacherWindow({
  lastDoneAt,
  oldestPendingAt,
  pendingCount,
  windowDays,
  restartAt = null,
  now = Date.now(),
}: TeacherWindowInput): TeacherWindowResult {
  const span = normalizeWindowDays(windowDays) * DAY_MS;
  const last = toTime(lastDoneAt);
  const oldest = toTime(oldestPendingAt);
  const result = (state: TeacherWindowState, dueTime: number | null): TeacherWindowResult => ({
    state,
    dueAt: dueTime === null ? null : new Date(dueTime).toISOString(),
    daysOverdue: state === "overdue" && dueTime !== null ? Math.floor((now - dueTime) / DAY_MS) : 0,
    daysLeft: (state === "met" || state === "grace") && dueTime !== null ? Math.max(0, Math.ceil((dueTime - now) / DAY_MS)) : 0,
  });

  if (last !== null && now < last + span) return result("met", last + span);
  if (pendingCount <= 0) return result("idle", null);

  // The clock starts at the last recorded treatment; a teacher who never
  // recorded one starts from their oldest pending plan, so a brand-new report
  // does not trigger an immediate reminder.
  const restart = toTime(restartAt);
  const anchor = last !== null || restart !== null ? Math.max(last ?? -Infinity, restart ?? -Infinity) : oldest;
  if (anchor === null) return result("idle", null);
  const dueTime = anchor + span;
  if (now < dueTime) return result("grace", dueTime);
  return result("overdue", dueTime);
}

export type WindowCandidate = { reportCreatedAt: string | null };

export type WindowResult<T extends WindowCandidate> = {
  isDue: boolean;
  dueSince: string | null;
  lastDoneAt: string | null;
  candidates: T[];
};

/**
 * Teacher-side view: is this teacher due right now, and which pending plans can
 * they choose from?
 *
 * @param doneTimes  every moment this teacher recorded a completed treatment
 * @param pending    their still-pending treatment plans (the pool to choose from)
 */
export function evaluateTreatmentWindow<T extends WindowCandidate>(
  doneTimes: Array<string | null | undefined>,
  pending: T[],
  windowDays: number = DEFAULT_TREATMENT_WINDOW_DAYS,
  now: number = Date.now(),
  restartAt: string | null = null,
): WindowResult<T> {
  const lastDoneAt = latestIso(doneTimes);
  const sorted = [...pending].sort((a, b) => (a.reportCreatedAt ?? "").localeCompare(b.reportCreatedAt ?? ""));
  const verdict = classifyTeacherWindow({
    lastDoneAt,
    oldestPendingAt: sorted[0]?.reportCreatedAt ?? null,
    pendingCount: sorted.length,
    windowDays,
    restartAt,
    now,
  });
  if (verdict.state !== "overdue") return { isDue: false, dueSince: null, lastDoneAt, candidates: [] };
  return { isDue: true, dueSince: verdict.dueAt, lastDoneAt, candidates: sorted };
}
