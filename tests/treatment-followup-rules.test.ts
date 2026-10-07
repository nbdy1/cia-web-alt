import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTreatmentWindow } from "../lib/treatment-followup-rules";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-07T00:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const plan = (days: number) => ({ reportCreatedAt: ago(days) });

test("nothing pending means nothing is due, even after months", () => {
  const result = evaluateTreatmentWindow([ago(90)], [], NOW);
  assert.equal(result.isDue, false);
  assert.equal(result.candidates.length, 0);
});

test("a treatment recorded within 14 days satisfies the window", () => {
  const result = evaluateTreatmentWindow([ago(5)], [plan(40), plan(20)], NOW);
  assert.equal(result.isDue, false);
  assert.deepEqual(result.candidates, []);
});

test("due once 14 days pass since the last recorded treatment", () => {
  const result = evaluateTreatmentWindow([ago(20), ago(30)], [plan(10)], NOW);
  assert.equal(result.isDue, true);
  assert.equal(result.lastDoneAt, ago(20));
  assert.equal(result.dueSince, ago(6)); // 20 - 14 days
});

test("exactly at the 14 day mark counts as due", () => {
  assert.equal(evaluateTreatmentWindow([ago(14)], [plan(3)], NOW).isDue, true);
  assert.equal(evaluateTreatmentWindow([ago(13.9)], [plan(3)], NOW).isDue, false);
});

test("never recorded: clock starts at the oldest pending plan, not now", () => {
  // Only a brand-new report: not due yet.
  assert.equal(evaluateTreatmentWindow([], [plan(2)], NOW).isDue, false);
  // Oldest pending plan is 3 weeks old: due.
  const result = evaluateTreatmentWindow([], [plan(2), plan(21)], NOW);
  assert.equal(result.isDue, true);
  assert.equal(result.dueSince, ago(7));
});

test("candidates are returned oldest report first", () => {
  const result = evaluateTreatmentWindow([ago(30)], [plan(3), plan(25), plan(10)], NOW);
  assert.deepEqual(result.candidates.map((c) => c.reportCreatedAt), [ago(25), ago(10), ago(3)]);
});

test("invalid or missing timestamps are ignored rather than throwing", () => {
  const result = evaluateTreatmentWindow([null, undefined, "not-a-date", ago(20)], [plan(1)], NOW);
  assert.equal(result.lastDoneAt, ago(20));
  assert.equal(result.isDue, true);
  // No usable anchor at all: stay quiet.
  assert.equal(evaluateTreatmentWindow([], [{ reportCreatedAt: null }], NOW).isDue, false);
});
