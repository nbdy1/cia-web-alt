import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_DIGEST_SESSIONS,
  UnusableSummaryError,
  buildSessionDigest,
  defaultReportMonth,
  deriveMonthFacts,
  diffSources,
  extractMonthCheckins,
  isSuggestedForSummary,
  isValidMonthKey,
  monthBounds,
  monthKeyFromIso,
  nextMonthKey,
  previousMonthKey,
  recentMonthKeys,
  sanitizeMonthlySummary,
  summaryState,
  type BkSessionRow,
} from "../lib/bk-monthly";

const session = (id: string, created_at: string, analysis: Record<string, unknown> = {}, title = `Sesi ${id}`): BkSessionRow => ({ id, created_at, title, analysis });

describe("month keys (Asia/Jakarta)", () => {
  it("validates month keys", () => {
    assert.equal(isValidMonthKey("2026-11"), true);
    assert.equal(isValidMonthKey("2026-13"), false);
    assert.equal(isValidMonthKey("2026-1"), false);
    assert.equal(isValidMonthKey(null), false);
  });

  it("puts an instant in the Jakarta month, not the UTC one", () => {
    // 31 Oct 20:00 UTC is already 1 Nov 03:00 in Jakarta.
    assert.equal(monthKeyFromIso("2026-10-31T20:00:00Z"), "2026-11");
    assert.equal(monthKeyFromIso("2026-10-31T16:59:00Z"), "2026-10");
    assert.equal(monthKeyFromIso("not a date"), null);
  });

  it("steps across year boundaries", () => {
    assert.equal(nextMonthKey("2026-12"), "2027-01");
    assert.equal(previousMonthKey("2027-01"), "2026-12");
    assert.deepEqual(recentMonthKeys("2026-11-02", 3), ["2026-11", "2026-10", "2026-09"]);
    assert.deepEqual(recentMonthKeys("2027-01-15", 2), ["2027-01", "2026-12"]);
  });

  it("month bounds are [start, end) in UTC for the Jakarta month", () => {
    assert.deepEqual(monthBounds("2026-11"), { startIso: "2026-10-31T17:00:00.000Z", endIso: "2026-11-30T17:00:00.000Z" });
    // A session at 00:30 on 1 Nov Jakarta belongs to November, one at 23:30 on 30 Nov too.
    const { startIso, endIso } = monthBounds("2026-11");
    assert.equal("2026-10-31T17:30:00.000Z" >= startIso, true);
    assert.equal("2026-11-30T16:30:00.000Z" < endIso, true);
    assert.equal("2026-11-30T17:00:00.000Z" < endIso, false);
  });

  it("defaults to last month in the first week, else the current month", () => {
    assert.equal(defaultReportMonth("2026-11-03"), "2026-10");
    assert.equal(defaultReportMonth("2026-11-07"), "2026-10");
    assert.equal(defaultReportMonth("2026-11-08"), "2026-11");
    assert.equal(defaultReportMonth("2027-01-02"), "2026-12");
  });
});

describe("facts are derived from data, not from the AI", () => {
  it("counts sessions, orders dates and keeps safety flags with their notes", () => {
    const sessions = [
      session("b", "2026-11-12T03:00:00Z", { needs_immediate_attention: true, safety_note: "Segera hubungi orang tua dan ikuti prosedur sekolah." }),
      session("a", "2026-11-03T03:00:00Z"),
    ];
    const facts = deriveMonthFacts(sessions, []);
    assert.equal(facts.sessionsCount, 2);
    assert.deepEqual(facts.sessionDates, ["2026-11-03", "2026-11-12"]);
    assert.equal(facts.safetyFlags.length, 1);
    assert.equal(facts.safetyFlags[0].date, "2026-11-12");
    assert.match(facts.safetyFlags[0].note, /prosedur sekolah/);
  });

  it("a session with the flag as a string 'true' is not treated as flagged (strict boolean)", () => {
    assert.equal(deriveMonthFacts([session("a", "2026-11-03T03:00:00Z", { needs_immediate_attention: "true" })], []).safetyFlags.length, 0);
  });

  it("reads analysis stored as a JSON string", () => {
    const row = { id: "a", created_at: "2026-11-03T03:00:00Z", title: "t", analysis: JSON.stringify({ needs_immediate_attention: true, safety_note: "x" }) };
    assert.equal(deriveMonthFacts([row], []).safetyFlags.length, 1);
  });
});

describe("follow-up check-ins", () => {
  const { startIso, endIso } = monthBounds("2026-11");
  const older = session("old", "2026-09-10T03:00:00Z", {
    follow_up_checkins: [
      { outcome: "done", reflection: "Sudah dicoba, anak mulai terbuka", created_at: "2026-11-05T03:00:00Z" },
      { outcome: "not_done", reflection: "Belum sempat", created_at: "2026-10-05T03:00:00Z" },
    ],
  });

  it("counts a check-in made in November on a September session", () => {
    const found = extractMonthCheckins([older], startIso, endIso);
    assert.equal(found.length, 1);
    assert.equal(found[0].outcome, "done");
    assert.equal(found[0].date, "2026-11-05");
  });

  it("tallies done vs not done", () => {
    const facts = deriveMonthFacts([], [
      { sessionTitle: "a", outcome: "done", reflection: "", date: "2026-11-05" },
      { sessionTitle: "a", outcome: "not_done", reflection: "", date: "2026-11-06" },
      { sessionTitle: "a", outcome: "not_done", reflection: "", date: "2026-11-07" },
    ]);
    assert.deepEqual(facts.followUps, { done: 1, notDone: 2 });
  });

  it("ignores check-ins without a usable date", () => {
    const bad = session("x", "2026-11-01T03:00:00Z", { follow_up_checkins: [{ outcome: "done", reflection: "r" }] });
    assert.equal(extractMonthCheckins([bad], startIso, endIso).length, 0);
  });
});

describe("digest sent to the AI stays small", () => {
  it("is bounded no matter how long the notes are", () => {
    const huge = "kalimat panjang ".repeat(500);
    const sessions = Array.from({ length: 14 }, (_, i) => session(String(i), `2026-11-${String(i + 1).padStart(2, "0")}T03:00:00Z`, { summary: huge, presenting_concerns: [huge, huge, huge, huge], follow_up: huge }));
    const digest = buildSessionDigest(sessions, []);
    assert.equal(digest.included, MAX_DIGEST_SESSIONS);
    assert.equal(digest.omitted, 4);
    // Hard ceiling: 10 sessions x ~3.2k chars of capped fields (about 9k tokens). A realistic
    // month (1-2 short sessions) is under 3k chars, so cost stays tiny; this only guards runaway input.
    assert.equal(digest.text.length < 35_000, true);
    assert.match(digest.text, /4 sesi lebih awal/);
  });

  it("keeps the most recent sessions when over the cap, in chronological order", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session(String(i), `2026-11-${String(i + 1).padStart(2, "0")}T03:00:00Z`, {}, `Judul-${i}`));
    const digest = buildSessionDigest(sessions, [], 3);
    assert.equal(digest.text.includes("Judul-0"), false);
    assert.equal(digest.text.indexOf("Judul-9") < digest.text.indexOf("Judul-11"), true);
  });

  it("never includes the raw transcript", () => {
    const row = { id: "a", created_at: "2026-11-03T03:00:00Z", title: "t", analysis: { summary: "ringkas" }, narrative: "RAHASIA TRANSKRIP" } as any;
    assert.equal(buildSessionDigest([row], []).text.includes("RAHASIA"), false);
  });

  it("flags safety sessions explicitly in the digest", () => {
    const digest = buildSessionDigest([session("a", "2026-11-03T03:00:00Z", { needs_immediate_attention: true })], []);
    assert.match(digest.text, /CATATAN KESELAMATAN/);
  });
});

describe("sanitising model output", () => {
  const factsMany = deriveMonthFacts([session("a", "2026-11-03T03:00:00Z"), session("b", "2026-11-10T03:00:00Z")], []);
  const factsOne = deriveMonthFacts([session("a", "2026-11-03T03:00:00Z")], []);
  const good = {
    overview: "Bulan ini siswa menunjukkan perkembangan yang baik dalam berinteraksi dengan teman.",
    areas: [{ area: "sosial", note: "Mulai bergaul" }, { area: "SOSIAL", note: "dup" }, { area: "agama", note: "tidak valid" }],
    progress: ["a", "b"], trend: "membaik",
  };

  it("keeps a trend when there are at least two sessions", () => {
    assert.equal(sanitizeMonthlySummary(good, factsMany, "2026-11", "id").trend, "membaik");
  });

  it("never claims a trend from a single session", () => {
    assert.equal(sanitizeMonthlySummary(good, factsOne, "2026-11", "id").trend, "belum_cukup_data");
  });

  it("a recorded follow-up gives enough basis for a trend even with one session", () => {
    const facts = deriveMonthFacts([session("a", "2026-11-03T03:00:00Z")], [{ sessionTitle: "a", outcome: "done", reflection: "", date: "2026-11-05" }]);
    assert.equal(sanitizeMonthlySummary(good, facts, "2026-11", "id").trend, "membaik");
  });

  it("restricts areas to the four guidance fields and removes duplicates", () => {
    const result = sanitizeMonthlySummary(good, factsMany, "2026-11", "id");
    assert.deepEqual(result.areas.map((a) => a.area), ["sosial"]);
  });

  it("rejects unknown trends", () => {
    assert.equal(sanitizeMonthlySummary({ ...good, trend: "memburuk" }, factsMany, "2026-11", "id").trend, "belum_cukup_data");
  });

  it("throws on an empty or junk overview so nothing unusable is saved", () => {
    assert.throws(() => sanitizeMonthlySummary({ overview: "" }, factsMany, "2026-11", "id"), UnusableSummaryError);
    assert.throws(() => sanitizeMonthlySummary(null, factsMany, "2026-11", "id"), UnusableSummaryError);
    assert.throws(() => sanitizeMonthlySummary("text", factsMany, "2026-11", "id"), UnusableSummaryError);
  });

  it("always stores the deterministic facts, whatever the AI returned", () => {
    const flagged = deriveMonthFacts([session("a", "2026-11-03T03:00:00Z", { needs_immediate_attention: true, safety_note: "n" })], []);
    const result = sanitizeMonthlySummary({ ...good, facts: { safetyFlags: [] } }, flagged, "2026-11", "id");
    assert.equal(result.facts.safetyFlags.length, 1);
  });

  it("clamps list sizes and item lengths", () => {
    const result = sanitizeMonthlySummary({ ...good, progress: Array.from({ length: 20 }, () => "x".repeat(900)) }, factsMany, "2026-11", "id");
    assert.equal(result.progress.length, 6);
    assert.equal(result.progress[0].length <= 301, true);
  });
});

describe("freshness", () => {
  it("detects sessions added after the summary was generated", () => {
    assert.deepEqual(diffSources(["a", "b"], ["a", "b", "c"]), { newCount: 1, isStale: true });
    assert.equal(diffSources(["a", "b"], ["b", "a"]).isStale, false);
    assert.equal(diffSources(["a", "b"], ["a"]).isStale, true); // a session was removed
  });

  it("derives the state shown in the UI", () => {
    assert.equal(summaryState(null, ["a"]), "missing");
    assert.equal(summaryState({ status: "draft", source_report_ids: ["a"] }, ["a"]), "draft");
    assert.equal(summaryState({ status: "draft", source_report_ids: ["a"] }, ["a", "b"]), "outdated");
    assert.equal(summaryState({ status: "final", source_report_ids: ["a"] }, ["a", "b"]), "final");
  });

  it("suggests summarising students with several sessions, a flag, or follow-ups", () => {
    assert.equal(isSuggestedForSummary(1, false), false);
    assert.equal(isSuggestedForSummary(2, false), true);
    assert.equal(isSuggestedForSummary(1, true), true);
    assert.equal(isSuggestedForSummary(1, false, 1), true);
  });
});
