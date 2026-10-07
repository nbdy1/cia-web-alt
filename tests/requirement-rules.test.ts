import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDaysToKey,
  dateKeyInZone,
  isDateInPause,
  isValidDateKey,
  isoWeekday,
  normalizePause,
  pauseRestartAt,
} from "../lib/requirement-rules";
import {
  DEFAULT_REPORT_REQUIREMENT,
  evaluateTeacherCycle,
  getCycles,
  normalizeReportRequirement,
  type TeacherReportInput,
} from "../lib/report-requirement-rules";
import { classifyTeacherWindow } from "../lib/treatment-followup-rules";

describe("date keys", () => {
  it("validates real calendar dates only", () => {
    assert.equal(isValidDateKey("2026-10-08"), true);
    assert.equal(isValidDateKey("2026-02-30"), false);
    assert.equal(isValidDateKey("2026-1-8"), false);
    assert.equal(isValidDateKey(null), false);
  });

  it("computes ISO weekdays (Mon=1 ... Sun=7)", () => {
    assert.equal(isoWeekday("2026-10-05"), 1); // Monday
    assert.equal(isoWeekday("2026-10-08"), 4); // Thursday
    assert.equal(isoWeekday("2026-10-11"), 7); // Sunday
    assert.equal(isoWeekday("1970-01-01"), 4);
  });

  it("adds days across month boundaries", () => {
    assert.equal(addDaysToKey("2026-10-31", 1), "2026-11-01");
    assert.equal(addDaysToKey("2026-03-01", -1), "2026-02-28");
  });

  it("reads the calendar day in Jakarta, not UTC", () => {
    // 20:00 UTC on the 7th is already 03:00 on the 8th in Jakarta.
    assert.equal(dateKeyInZone("2026-10-07T20:00:00Z"), "2026-10-08");
    assert.equal(dateKeyInZone("2026-10-07T16:59:00Z"), "2026-10-07");
    assert.equal(dateKeyInZone("garbage"), null);
  });
});

describe("pause", () => {
  it("is inactive without a start date", () => {
    assert.deepEqual(normalizePause(null, "2026-10-20"), { from: null, until: null });
    assert.equal(isDateInPause(normalizePause(null, null), "2026-10-08"), false);
  });

  it("covers a bounded range inclusively", () => {
    const pause = normalizePause("2026-10-10", "2026-10-20");
    assert.equal(isDateInPause(pause, "2026-10-09"), false);
    assert.equal(isDateInPause(pause, "2026-10-10"), true);
    assert.equal(isDateInPause(pause, "2026-10-20"), true);
    assert.equal(isDateInPause(pause, "2026-10-21"), false);
  });

  it("an open-ended pause lasts until removed", () => {
    const pause = normalizePause("2026-10-10", null);
    assert.equal(isDateInPause(pause, "2027-01-01"), true);
  });

  it("drops an end date that is before the start", () => {
    assert.deepEqual(normalizePause("2026-10-10", "2026-10-01"), { from: "2026-10-10", until: null });
  });

  it("restart instant only exists once the pause is over", () => {
    const pause = normalizePause("2026-10-10", "2026-10-20");
    const during = Date.parse("2026-10-15T00:00:00Z");
    const after = Date.parse("2026-10-25T00:00:00Z");
    assert.equal(pauseRestartAt(pause, during), null);
    assert.equal(pauseRestartAt(pause, after), "2026-10-20T17:00:00.000Z"); // 21 Oct 00:00 Jakarta
    assert.equal(pauseRestartAt(normalizePause("2026-10-10", null), after), null);
  });
});

describe("report cycles (default: weekly, deadline Thursday)", () => {
  const req = DEFAULT_REPORT_REQUIREMENT;

  it("mid-week points at the coming Thursday", () => {
    const { current, previous } = getCycles(req, "2026-10-07"); // Wednesday
    assert.equal(current.start, "2026-10-02"); // Friday
    assert.equal(current.end, "2026-10-08");
    assert.equal(current.daysLeft, 1);
    assert.equal(previous.start, "2026-09-25");
    assert.equal(previous.end, "2026-10-01");
  });

  it("the deadline day itself is still inside the cycle", () => {
    const { current } = getCycles(req, "2026-10-08"); // Thursday
    assert.equal(current.end, "2026-10-08");
    assert.equal(current.daysLeft, 0);
  });

  it("the day after the deadline starts a new cycle", () => {
    const { current, previous } = getCycles(req, "2026-10-09"); // Friday
    assert.equal(current.start, "2026-10-09");
    assert.equal(current.end, "2026-10-15");
    assert.equal(previous.end, "2026-10-08");
  });

  it("supports other weekdays and multi-week cycles", () => {
    const friday = getCycles({ ...req, deadlineWeekday: 5 }, "2026-10-07");
    assert.equal(friday.current.end, "2026-10-09");
    const biweekly = getCycles({ ...req, cycleWeeks: 2 }, "2026-10-07");
    assert.equal(isoWeekday(biweekly.current.end), 4);
    assert.equal(biweekly.current.start > biweekly.previous.end, true);
    // 14-day cycles: previous deadline is exactly 14 days before the current one.
    assert.equal(addDaysToKey(biweekly.previous.end, 14), biweekly.current.end);
  });

  it("normalizes bad settings to safe values", () => {
    assert.deepEqual(normalizeReportRequirement({ cycleWeeks: 99, deadlineWeekday: 0, mode: "x", minCount: -3 }), {
      cycleWeeks: 4,
      deadlineWeekday: 1,
      mode: "per_student",
      minCount: 1,
    });
    assert.deepEqual(normalizeReportRequirement(null), DEFAULT_REPORT_REQUIREMENT);
  });
});

describe("evaluating a teacher's cycle", () => {
  const cycle = { start: "2026-10-02", end: "2026-10-08" };
  const at = (day: string) => `${day}T03:00:00Z`; // 10:00 Jakarta
  const student = (id: string, days: string[], extra: Partial<TeacherReportInput> = {}): TeacherReportInput => ({
    id,
    name: id.toUpperCase(),
    reports: days.map((day) => ({ created_at: at(day), created_by: "t1" })),
    ...extra,
  });

  it("per student: complete when every assigned student has a report in the cycle", () => {
    const result = evaluateTeacherCycle("t1", [student("a", ["2026-10-05"]), student("b", ["2026-10-08"])], DEFAULT_REPORT_REQUIREMENT, cycle, false);
    assert.equal(result.status, "complete");
    assert.equal(result.done, 2);
    assert.equal(result.required, 2);
  });

  it("per student: lists who is missing, in progress before the deadline and missed after", () => {
    const students = [student("a", ["2026-10-05"]), student("b", ["2026-09-30"]), student("c", [])];
    const early = evaluateTeacherCycle("t1", students, DEFAULT_REPORT_REQUIREMENT, cycle, false);
    assert.equal(early.status, "in_progress");
    assert.deepEqual(early.missing.map((m) => m.id), ["b", "c"]);
    const late = evaluateTeacherCycle("t1", students, DEFAULT_REPORT_REQUIREMENT, cycle, true);
    assert.equal(late.status, "missed");
  });

  it("a report on the day after the deadline does not count", () => {
    const result = evaluateTeacherCycle("t1", [student("a", ["2026-10-09"])], DEFAULT_REPORT_REQUIREMENT, cycle, true);
    assert.equal(result.status, "missed");
  });

  it("a late-evening Thursday report in Jakarta still counts (UTC date is Thursday)", () => {
    const lateThursday = { id: "a", name: "A", reports: [{ created_at: "2026-10-08T16:30:00Z", created_by: "t1" }] }; // 23:30 Jakarta
    assert.equal(evaluateTeacherCycle("t1", [lateThursday], DEFAULT_REPORT_REQUIREMENT, cycle, true).status, "complete");
    const justAfterMidnight = { id: "a", name: "A", reports: [{ created_at: "2026-10-08T17:30:00Z", created_by: "t1" }] }; // 00:30 Fri Jakarta
    assert.equal(evaluateTeacherCycle("t1", [justAfterMidnight], DEFAULT_REPORT_REQUIREMENT, cycle, true).status, "missed");
  });

  it("respects a higher per-student minimum", () => {
    const req = { ...DEFAULT_REPORT_REQUIREMENT, minCount: 2 };
    const one = evaluateTeacherCycle("t1", [student("a", ["2026-10-05"])], req, cycle, true);
    assert.equal(one.status, "missed");
    assert.equal(one.missing[0].count, 1);
    assert.equal(evaluateTeacherCycle("t1", [student("a", ["2026-10-05", "2026-10-06"])], req, cycle, true).status, "complete");
  });

  it("students outside the roster never create per-student obligations", () => {
    const result = evaluateTeacherCycle("t1", [student("a", ["2026-10-05"]), student("x", [], { isCross: true })], DEFAULT_REPORT_REQUIREMENT, cycle, true);
    assert.equal(result.status, "complete");
    assert.equal(result.required, 1);
  });

  it("a teacher with no roster is idle, not missed", () => {
    assert.equal(evaluateTeacherCycle("t1", [], DEFAULT_REPORT_REQUIREMENT, cycle, true).status, "idle");
  });

  it("per teacher: counts the teacher's own reports across all students", () => {
    const req = { ...DEFAULT_REPORT_REQUIREMENT, mode: "per_teacher" as const, minCount: 3 };
    const students = [
      student("a", ["2026-10-05", "2026-10-06"]),
      student("x", ["2026-10-07"], { isCross: true }),
      // Someone else's report on the teacher's student must not count for them.
      { id: "b", name: "B", reports: [{ created_at: at("2026-10-07"), created_by: "t2" }] },
    ];
    const result = evaluateTeacherCycle("t1", students, req, cycle, true);
    assert.equal(result.done, 3);
    assert.equal(result.status, "complete");
    assert.equal(evaluateTeacherCycle("t1", students, { ...req, minCount: 4 }, cycle, true).status, "missed");
  });

  it("per teacher: legacy reports with no author count for the assigned teacher only", () => {
    const req = { ...DEFAULT_REPORT_REQUIREMENT, mode: "per_teacher" as const, minCount: 1 };
    const legacy = { id: "a", name: "A", reports: [{ created_at: at("2026-10-05"), created_by: null }] };
    assert.equal(evaluateTeacherCycle("t1", [legacy], req, cycle, true).status, "complete");
    assert.equal(evaluateTeacherCycle("t1", [{ ...legacy, isCross: true }], req, cycle, true).status, "missed");
  });
});

describe("treatment clock after a pause", () => {
  const NOW = Date.parse("2026-10-30T00:00:00Z");
  const day = 86_400_000;
  const ago = (d: number) => new Date(NOW - d * day).toISOString();

  it("restarts the window when the pause ended, instead of leaving teachers overdue", () => {
    const base = { lastDoneAt: ago(40), oldestPendingAt: ago(60), pendingCount: 3, windowDays: 14, now: NOW };
    assert.equal(classifyTeacherWindow(base).state, "overdue");
    const restarted = classifyTeacherWindow({ ...base, restartAt: ago(3) });
    assert.equal(restarted.state, "grace");
    assert.equal(restarted.daysLeft, 11);
    // ...and it is overdue again once a full window has passed since the restart.
    assert.equal(classifyTeacherWindow({ ...base, restartAt: ago(15) }).state, "overdue");
  });

  it("a real treatment after the pause still wins", () => {
    const state = classifyTeacherWindow({ lastDoneAt: ago(2), oldestPendingAt: ago(60), pendingCount: 1, windowDays: 14, restartAt: ago(20), now: NOW });
    assert.equal(state.state, "met");
  });

  it("applies to teachers who never recorded a treatment too", () => {
    const state = classifyTeacherWindow({ lastDoneAt: null, oldestPendingAt: ago(90), pendingCount: 2, windowDays: 14, restartAt: ago(5), now: NOW });
    assert.equal(state.state, "grace");
  });
});
