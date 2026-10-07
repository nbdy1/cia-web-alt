/**
 * lib/requirement-rules.ts
 *
 * Shared, dependency-free date + pause helpers for the admin-configurable
 * requirements (weekly report target, treatment follow-up target). All calendar
 * days are "date keys" (YYYY-MM-DD) in the school's time zone, so server and
 * browser agree on what "today" and "Thursday" mean regardless of the device.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";
// Asia/Jakarta has no daylight saving, so a fixed offset is exact.
const APP_UTC_OFFSET = "+07:00";
const DAY_MS = 86_400_000;

export type DateKey = string;

const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !KEY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The calendar day of an instant in the school's time zone, or null if unparseable. */
export function dateKeyInZone(input: Date | number | string, timeZone = APP_TIME_ZONE): DateKey | null {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Days since 1970-01-01 for a date key. */
export function dayIndex(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function keyFromDayIndex(index: number): DateKey {
  const date = new Date(index * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return keyFromDayIndex(dayIndex(key) + days);
}

/** ISO weekday of a date key: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(key: DateKey): number {
  // 1970-01-01 was a Thursday (ISO 4).
  return (((dayIndex(key) + 3) % 7) + 7) % 7 + 1;
}

// ─── Pause ───────────────────────────────────────────────────────────────────

/** from === null means "no pause"; until === null means "until turned back on". */
export type PauseWindow = { from: DateKey | null; until: DateKey | null };

export const NO_PAUSE: PauseWindow = { from: null, until: null };

export function normalizePause(from: unknown, until: unknown): PauseWindow {
  const start = isValidDateKey(from) ? from : null;
  if (!start) return NO_PAUSE;
  const end = isValidDateKey(until) && until >= start ? until : null;
  return { from: start, until: end };
}

/** Is the requirement paused on this calendar day? */
export function isDateInPause(pause: PauseWindow, key: DateKey): boolean {
  if (!pause.from || key < pause.from) return false;
  return pause.until === null || key <= pause.until;
}

/**
 * After a pause ends, a treatment clock should start fresh instead of leaving
 * everyone instantly overdue. Returns the first instant after the pause (ISO), but
 * only once that moment has arrived; null otherwise (including open-ended pauses).
 */
export function pauseRestartAt(pause: PauseWindow, now: number = Date.now()): string | null {
  if (!pause.from || !pause.until) return null;
  const restart = new Date(`${addDaysToKey(pause.until, 1)}T00:00:00${APP_UTC_OFFSET}`);
  return restart.getTime() <= now ? restart.toISOString() : null;
}
