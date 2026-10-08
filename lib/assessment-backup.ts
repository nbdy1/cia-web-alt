/**
 * lib/assessment-backup.ts
 *
 * The finished AI analysis is handed from the assessment page to the results page
 * through sessionStorage (it is too large for the URL). sessionStorage belongs to
 * one tab, so it is gone when a phone discards the tab while the teacher switches
 * apps, or when the page is reopened from history — and the results page used to
 * spin forever in that case, losing an expensive analysis.
 *
 * This keeps a short-lived backup copy in localStorage (survives a discarded or
 * re-opened tab), keyed by student so one student's analysis can never show up for
 * another. It is removed as soon as the report is saved, and ignored once stale.
 * Every function swallows storage errors (private mode, quota) — a backup must
 * never be the reason a flow breaks.
 */
export const BACKUP_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type AssessmentBackup = {
  analysis: unknown;
  narrative: string;
  model: string;
  savedAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyFor = (studentId: string) => `cia:assessment-backup:${studentId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveAssessmentBackup(
  studentId: string,
  data: Omit<AssessmentBackup, "savedAt">,
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): void {
  if (!storage || !studentId) return;
  try {
    storage.setItem(keyFor(studentId), JSON.stringify({ ...data, savedAt: now } satisfies AssessmentBackup));
  } catch {
    // Quota or privacy mode: the backup is best-effort.
  }
}

export function loadAssessmentBackup(
  studentId: string,
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): AssessmentBackup | null {
  if (!storage || !studentId) return null;
  try {
    const raw = storage.getItem(keyFor(studentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssessmentBackup> | null;
    if (!parsed || typeof parsed.savedAt !== "number" || parsed.analysis == null) return null;
    if (now - parsed.savedAt > BACKUP_MAX_AGE_MS || parsed.savedAt > now + 60_000) {
      storage.removeItem(keyFor(studentId));
      return null;
    }
    return {
      analysis: parsed.analysis,
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearAssessmentBackup(studentId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage || !studentId) return;
  try {
    storage.removeItem(keyFor(studentId));
  } catch {
    // ignore
  }
}
