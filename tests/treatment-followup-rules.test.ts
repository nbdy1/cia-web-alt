import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyTeacherWindow, evaluateTreatmentWindow, normalizeWindowDays } from "../lib/treatment-followup-rules";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-07T00:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const plan = (days: number) => ({ reportCreatedAt: ago(days) });

test("nothing pending means nothing is due, even after months", () => {
  const result = evaluateTreatmentWindow([ago(90)], [], 14, NOW);
  assert.equal(result.isDue, false);
  assert.equal(result.candidates.length, 0);
});

test("a treatment recorded within 14 days satisfies the window", () => {
  const result = evaluateTreatmentWindow([ago(5)], [plan(40), plan(20)], 14, NOW);
  assert.equal(result.isDue, false);
  assert.deepEqual(result.candidates, []);
});

test("due once 14 days pass since the last recorded treatment", () => {
  const result = evaluateTreatmentWindow([ago(20), ago(30)], [plan(10)], 14, NOW);
  assert.equal(result.isDue, true);
  assert.equal(result.lastDoneAt, ago(20));
  assert.equal(result.dueSince, ago(6)); // 20 - 14 days
});

test("exactly at the 14 day mark counts as due", () => {
  assert.equal(evaluateTreatmentWindow([ago(14)], [plan(3)], 14, NOW).isDue, true);
  assert.equal(evaluateTreatmentWindow([ago(13.9)], [plan(3)], 14, NOW).isDue, false);
});

test("never recorded: clock starts at the oldest pending plan, not now", () => {
  // Only a brand-new report: not due yet.
  assert.equal(evaluateTreatmentWindow([], [plan(2)], 14, NOW).isDue, false);
  // Oldest pending plan is 3 weeks old: due.
  const result = evaluateTreatmentWindow([], [plan(2), plan(21)], 14, NOW);
  assert.equal(result.isDue, true);
  assert.equal(result.dueSince, ago(7));
});

test("candidates are returned oldest report first", () => {
  const result = evaluateTreatmentWindow([ago(30)], [plan(3), plan(25), plan(10)], 14, NOW);
  assert.deepEqual(result.candidates.map((c) => c.reportCreatedAt), [ago(25), ago(10), ago(3)]);
});

test("invalid or missing timestamps are ignored rather than throwing", () => {
  const result = evaluateTreatmentWindow([null, undefined, "not-a-date", ago(20)], [plan(1)], 14, NOW);
  assert.equal(result.lastDoneAt, ago(20));
  assert.equal(result.isDue, true);
  // No usable anchor at all: stay quiet.
  assert.equal(evaluateTreatmentWindow([], [{ reportCreatedAt: null }], 14, NOW).isDue, false);
});

test("the window length is configurable", () => {
  // Last treatment 10 days ago: fine under a 14-day rule, overdue under a 7-day rule.
  assert.equal(evaluateTreatmentWindow([ago(10)], [plan(3)], 14, NOW).isDue, false);
  assert.equal(evaluateTreatmentWindow([ago(10)], [plan(3)], 7, NOW).isDue, true);
  assert.equal(evaluateTreatmentWindow([ago(10)], [plan(3)], 7, NOW).dueSince, ago(3));
});

test("normalizeWindowDays clamps and defaults", () => {
  assert.equal(normalizeWindowDays(21), 21);
  assert.equal(normalizeWindowDays("30"), 30);
  assert.equal(normalizeWindowDays(0), 1);
  assert.equal(normalizeWindowDays(500), 90);
  assert.equal(normalizeWindowDays(6.6), 7);
  assert.equal(normalizeWindowDays(null), 14);
  assert.equal(normalizeWindowDays(undefined), 14);
  assert.equal(normalizeWindowDays("abc"), 14);
});

test("classifyTeacherWindow covers all four states", () => {
  const base = { windowDays: 14, now: NOW };
  const met = classifyTeacherWindow({ ...base, lastDoneAt: ago(4), oldestPendingAt: ago(30), pendingCount: 2 });
  assert.equal(met.state, "met");
  assert.equal(met.daysLeft, 10);

  // A recent treatment counts as met even when nothing is pending any more.
  assert.equal(classifyTeacherWindow({ ...base, lastDoneAt: ago(2), oldestPendingAt: null, pendingCount: 0 }).state, "met");

  const overdue = classifyTeacherWindow({ ...base, lastDoneAt: ago(20), oldestPendingAt: ago(30), pendingCount: 1 });
  assert.equal(overdue.state, "overdue");
  assert.equal(overdue.daysOverdue, 6);

  const grace = classifyTeacherWindow({ ...base, lastDoneAt: null, oldestPendingAt: ago(5), pendingCount: 1 });
  assert.equal(grace.state, "grace");
  assert.equal(grace.daysLeft, 9);

  const idle = classifyTeacherWindow({ ...base, lastDoneAt: ago(60), oldestPendingAt: null, pendingCount: 0 });
  assert.equal(idle.state, "idle");
  assert.equal(idle.dueAt, null);

  // Never recorded and the oldest plan is already old: overdue.
  assert.equal(classifyTeacherWindow({ ...base, lastDoneAt: null, oldestPendingAt: ago(40), pendingCount: 3 }).state, "overdue");
});

test("changing the window re-classifies the same teacher", () => {
  const input = { lastDoneAt: ago(10), oldestPendingAt: ago(30), pendingCount: 2, now: NOW };
  assert.equal(classifyTeacherWindow({ ...input, windowDays: 7 }).state, "overdue");
  assert.equal(classifyTeacherWindow({ ...input, windowDays: 14 }).state, "met");
  assert.equal(classifyTeacherWindow({ ...input, windowDays: 30 }).state, "met");
});
