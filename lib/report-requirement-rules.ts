/**
 * lib/report-requirement-rules.ts
 *
 * Pure rules for the admin-configurable weekly report target ("by Thursday every
 * teacher has written a report for each student they supervise"). Shared by the
 * admin screen (computed in the browser so the admin can preview a change before
 * saving) and unit tests (tests/report-requirement-rules.test.ts).
 */
import {
  addDaysToKey,
  dateKeyInZone,
  dayIndex,
  keyFromDayIndex,
  type DateKey,
} from "@/lib/requirement-rules";

export type ReportRequirementMode = "per_student" | "per_teacher";

export type ReportRequirement = {
  /** Length of one cycle in weeks (1-4). */
  cycleWeeks: number;
  /** ISO weekday the cycle's deadline falls on: 1 = Monday ... 7 = Sunday. */
  deadlineWeekday: number;
  mode: ReportRequirementMode;
  /** per_student: reports needed for EACH student. per_teacher: reports needed in total. */
  minCount: number;
};

/** The rule schools were already following by hand: weekly, by Thursday, every student. */
export const DEFAULT_REPORT_REQUIREMENT: ReportRequirement = {
  cycleWeeks: 1,
  deadlineWeekday: 4,
  mode: "per_student",
  minCount: 1,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeReportRequirement(raw: Partial<Record<keyof ReportRequirement, unknown>> | null | undefined): ReportRequirement {
  return {
    cycleWeeks: clampInt(raw?.cycleWeeks, 1, 4, DEFAULT_REPORT_REQUIREMENT.cycleWeeks),
    deadlineWeekday: clampInt(raw?.deadlineWeekday, 1, 7, DEFAULT_REPORT_REQUIREMENT.deadlineWeekday),
    mode: raw?.mode === "per_teacher" ? "per_teacher" : "per_student",
    minCount: clampInt(raw?.minCount, 1, 50, DEFAULT_REPORT_REQUIREMENT.minCount),
  };
}

export type Cycle = {
  /** First day reports count towards this cycle's deadline (inclusive). */
  start: DateKey;
  /** The deadline day itself (inclusive: reports written that day still count). */
  end: DateKey;
};

/**
 * The cycle containing `today` plus the one before it. A deadline falls every
 * `cycleWeeks` weeks on `deadlineWeekday`; a cycle runs from the day after the
 * previous deadline through its own deadline. Multi-week cycles are aligned to a
 * fixed calendar (1970-01-01) so every device agrees on which weeks pair up.
 */
export function getCycles(req: ReportRequirement, today: DateKey): { current: Cycle & { daysLeft: number }; previous: Cycle } {
  const span = req.cycleWeeks * 7;
  // First day (>= 1970-01-01, a Thursday) that has the deadline weekday.
  const firstDeadline = (((req.deadlineWeekday - 4) % 7) + 7) % 7;
  const t = dayIndex(today);
  const k = Math.ceil((t - firstDeadline) / span);
  const endIndex = firstDeadline + k * span;
  const previousEnd = endIndex - span;
  return {
    current: { start: addDaysToKey(keyFromDayIndex(previousEnd), 1), end: keyFromDayIndex(endIndex), daysLeft: endIndex - t },
    previous: { start: addDaysToKey(keyFromDayIndex(previousEnd - span), 1), end: keyFromDayIndex(previousEnd) },
  };
}

export type CycleStatus = "complete" | "in_progress" | "missed" | "idle";

export type TeacherReportInput = {
  id: string;
  name: string;
  /** Reports can include students outside the roster (isCross) the teacher wrote about. */
  isCross?: boolean;
  reports: Array<{ created_at: string; created_by?: string | null }>;
};

export type CycleEvaluation = {
  status: CycleStatus;
  /** per_student: students that need a report. per_teacher: the minimum total. */
  required: number;
  /** per_student: students covered. per_teacher: reports written (may exceed required). */
  done: number;
  /** per_student only: assigned students still short, with how many reports they have. */
  missing: Array<{ id: string; name: string; count: number }>;
};

function inCycle(createdAt: string, cycle: Cycle): boolean {
  const key = dateKeyInZone(createdAt);
  return key !== null && key >= cycle.start && key <= cycle.end;
}

/**
 * @param isEnded  true once the cycle's deadline has passed: unmet becomes "missed"
 *                 instead of "in_progress".
 */
export function evaluateTeacherCycle(
  teacherId: string,
  students: TeacherReportInput[],
  req: ReportRequirement,
  cycle: Cycle,
  isEnded: boolean,
): CycleEvaluation {
  const unmet: CycleStatus = isEnded ? "missed" : "in_progress";

  if (req.mode === "per_teacher") {
    // Reports with no recorded author predate authorship tracking and belong to the
    // assigned teacher, so they only count on the teacher's own roster.
    let total = 0;
    for (const student of students) {
      for (const report of student.reports) {
        const mine = report.created_by === teacherId || (!report.created_by && !student.isCross);
        if (mine && inCycle(report.created_at, cycle)) total++;
      }
    }
    if (students.length === 0 && total === 0) return { status: "idle", required: req.minCount, done: 0, missing: [] };
    return { status: total >= req.minCount ? "complete" : unmet, required: req.minCount, done: total, missing: [] };
  }

  const roster = students.filter((student) => !student.isCross);
  if (roster.length === 0) return { status: "idle", required: 0, done: 0, missing: [] };
  const missing: CycleEvaluation["missing"] = [];
  let covered = 0;
  for (const student of roster) {
    // A report by anyone counts: what matters is that the student was written up.
    const count = student.reports.filter((report) => inCycle(report.created_at, cycle)).length;
    if (count >= req.minCount) covered++;
    else missing.push({ id: student.id, name: student.name, count });
  }
  return {
    status: covered === roster.length ? "complete" : unmet,
    required: roster.length,
    done: covered,
    missing: missing.sort((a, b) => a.name.localeCompare(b.name, "id")),
  };
}
