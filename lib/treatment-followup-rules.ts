/**
 * lib/treatment-followup-rules.ts
 *
 * Pure decision logic for the "at least one treatment every two weeks" rule, kept
 * separate from the database code in app/actions/treatment-followups.ts so it can
 * be unit tested (tests/treatment-followup-rules.test.ts).
 */
export const TREATMENT_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export type WindowCandidate = { reportCreatedAt: string | null };

export type WindowResult<T extends WindowCandidate> = {
  isDue: boolean;
  dueSince: string | null;
  lastDoneAt: string | null;
  candidates: T[];
};

function latestIso(values: Array<string | null | undefined>): string | null {
  let best: number | null = null;
  for (const value of values) {
    const time = value ? new Date(value).getTime() : NaN;
    if (Number.isFinite(time) && (best === null || time > best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

/**
 * @param doneTimes  every moment this teacher recorded a completed treatment
 * @param pending    their still-pending treatment plans (the pool to choose from)
 * @param now        injectable clock
 *
 * The window starts at the last recorded treatment. A teacher who has never
 * recorded one starts from their oldest pending plan, so a brand-new report does
 * not trigger an immediate reminder. Nothing is due when there is nothing pending.
 */
export function evaluateTreatmentWindow<T extends WindowCandidate>(
  doneTimes: Array<string | null | undefined>,
  pending: T[],
  now: number = Date.now(),
): WindowResult<T> {
  const lastDoneAt = latestIso(doneTimes);
  const none: WindowResult<T> = { isDue: false, dueSince: null, lastDoneAt, candidates: [] };
  if (pending.length === 0) return none;

  const sorted = [...pending].sort((a, b) => (a.reportCreatedAt ?? "").localeCompare(b.reportCreatedAt ?? ""));
  const windowStart = lastDoneAt ?? sorted[0].reportCreatedAt;
  const startTime = windowStart ? new Date(windowStart).getTime() : NaN;
  if (!Number.isFinite(startTime)) return none;

  const dueAt = startTime + TREATMENT_WINDOW_DAYS * DAY_MS;
  if (now < dueAt) return none;
  return { isDue: true, dueSince: new Date(dueAt).toISOString(), lastDoneAt, candidates: sorted };
}
