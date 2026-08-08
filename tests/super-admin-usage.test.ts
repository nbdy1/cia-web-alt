import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOrgRow,
  monthStart,
  toDateStr,
  tomorrow,
  rangeToDates,
  summarizeByProvider,
  pivotDailyByProvider,
  weekStartKeyUTC,
  summarizeAppWindow,
  computeDrift,
  summarizeCostByOrg,
  topOrgIdsByCost,
  pivotDailyByOrg,
  orgSeriesKey,
  type BreakdownRow,
  type DailyRow,
  type DailyOrgRow,
} from "../lib/super-admin/usage-helpers";

describe("buildOrgRow", () => {
  it("computes revenue/cost/margin for an active paying org", () => {
    const row = buildOrgRow(
      { id: "org-1", name: "Pesantren A" },
      { status: "active", plan_id: "plan-1", custom_price_idr: null },
      { name: "Pro", price_idr: 500_000, max_reports_per_period: 100, max_voice_chars_per_period: 200_000 },
      { reports_used: 40, voice_chars: 12_000, cost_idr: 150_000 },
    );
    assert.equal(row.revenue, 500_000);
    assert.equal(row.cost, 150_000);
    assert.equal(row.margin, 350_000);
    assert.equal(row.marginPct, 0.7);
    assert.equal(row.plan, "Pro");
    assert.equal(row.status, "active");
    assert.equal(row.reportsUsed, 40);
    assert.equal(row.reportsLimit, 100);
    assert.equal(row.voiceUsed, 12_000);
    assert.equal(row.voiceLimit, 200_000);
  });

  it("prefers a custom negotiated price over the plan's list price", () => {
    const row = buildOrgRow(
      { id: "org-1", name: "Pesantren A" },
      { status: "active", plan_id: "plan-1", custom_price_idr: 350_000 },
      { name: "Pro", price_idr: 500_000 },
      undefined,
    );
    assert.equal(row.revenue, 350_000);
  });

  it("counts zero revenue for a non-active subscription even if a plan exists", () => {
    for (const status of ["past_due", "canceled", "trialing"]) {
      const row = buildOrgRow(
        { id: "org-1", name: "Pesantren A" },
        { status, plan_id: "plan-1" },
        { name: "Pro", price_idr: 500_000 },
        { cost_idr: 10_000 },
      );
      assert.equal(row.revenue, 0, `status=${status} should not count as revenue`);
      assert.equal(row.margin, -10_000);
    }
  });

  it("treats a missing subscription as status 'none' with zero revenue", () => {
    const row = buildOrgRow({ id: "org-1", name: "Pesantren A" }, undefined, undefined, undefined);
    assert.equal(row.status, "none");
    assert.equal(row.revenue, 0);
    assert.equal(row.cost, 0);
    assert.equal(row.margin, 0);
  });

  it("returns marginPct null instead of dividing by zero when revenue is zero", () => {
    const row = buildOrgRow({ id: "org-1", name: "Pesantren A" }, { status: "none" }, null, { cost_idr: 5_000 });
    assert.equal(row.revenue, 0);
    assert.equal(row.marginPct, null);
  });

  it("falls back to an em dash for plan name and null for limits when there's no plan", () => {
    const row = buildOrgRow({ id: "org-1", name: "Pesantren A" }, { status: "active", custom_price_idr: 100_000 }, null, undefined);
    assert.equal(row.plan, "—");
    assert.equal(row.reportsLimit, null);
    assert.equal(row.voiceLimit, null);
  });

  it("coerces missing/null cost and voice_chars to 0 rather than NaN", () => {
    const row = buildOrgRow({ id: "org-1", name: "X" }, { status: "active" }, { price_idr: 10_000 }, { cost_idr: undefined as any, voice_chars: undefined as any });
    assert.equal(row.cost, 0);
    assert.equal(row.voiceUsed, 0);
    assert.equal(Number.isNaN(row.margin), false);
  });
});

describe("date range helpers", () => {
  it("monthStart returns the 1st of the given month at local midnight", () => {
    const d = monthStart(new Date(2026, 7, 15)); // Aug 15 2026 (local)
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 1);
  });

  it("toDateStr formats as YYYY-MM-01 zero-padded", () => {
    assert.equal(toDateStr(new Date(2026, 0, 15)), "2026-01-01");
    assert.equal(toDateStr(new Date(2026, 10, 3)), "2026-11-01");
  });

  it("tomorrow adds exactly 24 hours to the given instant", () => {
    const now = new Date("2026-08-07T10:00:00.000Z");
    assert.equal(tomorrow(now).toISOString(), "2026-08-08T10:00:00.000Z");
  });

  it("rangeToDates('month') spans the 1st of this month through tomorrow", () => {
    const now = new Date(2026, 7, 15, 12, 0, 0);
    const { from, to } = rangeToDates("month", now);
    assert.equal(from.getDate(), 1);
    assert.equal(from.getMonth(), 7);
    assert.equal(to.getTime(), tomorrow(now).getTime());
  });

  it("rangeToDates('6m') starts at the 1st of the month 5 months back", () => {
    const now = new Date(2026, 7, 15); // Aug 2026
    const { from } = rangeToDates("6m", now);
    assert.equal(from.getFullYear(), 2026);
    assert.equal(from.getMonth(), 2); // March (Aug - 5)
    assert.equal(from.getDate(), 1);
  });

  it("rangeToDates('6m') correctly rolls back across a year boundary", () => {
    const now = new Date(2026, 1, 10); // Feb 2026
    const { from } = rangeToDates("6m", now);
    assert.equal(from.getFullYear(), 2025);
    assert.equal(from.getMonth(), 8); // September 2025
  });

  it("rangeToDates('all') starts at the epoch-ish year 2000", () => {
    const { from } = rangeToDates("all", new Date(2026, 7, 15));
    assert.equal(from.getFullYear(), 2000);
  });
});

describe("summarizeByProvider", () => {
  const row = (over: Partial<BreakdownRow>): BreakdownRow => ({
    purpose: "tts",
    provider: "elevenlabs",
    cost_idr: 0,
    cost_usd: 0,
    input_tokens: 0,
    output_tokens: 0,
    char_count: 0,
    event_count: 0,
    ...over,
  });

  it("sums fields per provider across multiple rows", () => {
    const totals = summarizeByProvider([
      row({ provider: "openrouter", cost_idr: 1000, cost_usd: 0.06, input_tokens: 100, output_tokens: 50, event_count: 2 }),
      row({ provider: "openrouter", cost_idr: 500, cost_usd: 0.03, input_tokens: 40, output_tokens: 10, event_count: 1 }),
      row({ provider: "elevenlabs", cost_idr: 2000, cost_usd: 0.11, char_count: 500, event_count: 3 }),
    ]);
    assert.equal(totals.openrouter.cost, 1500);
    assert.equal(totals.openrouter.costUsd, 0.09);
    assert.equal(totals.openrouter.inputTokens, 140);
    assert.equal(totals.openrouter.outputTokens, 60);
    assert.equal(totals.openrouter.events, 3);
    assert.equal(totals.elevenlabs.cost, 2000);
    assert.equal(totals.elevenlabs.chars, 500);
  });

  it("returns an empty object for no rows", () => {
    assert.deepEqual(summarizeByProvider([]), {});
  });

  it("treats missing/null numeric fields as 0 instead of producing NaN", () => {
    const totals = summarizeByProvider([
      row({ provider: "elevenlabs", cost_idr: null as any, char_count: undefined as any }),
    ]);
    assert.equal(totals.elevenlabs.cost, 0);
    assert.equal(totals.elevenlabs.chars, 0);
  });

  it("keeps unrelated providers in separate buckets, not merged", () => {
    const totals = summarizeByProvider([
      row({ provider: "openrouter", input_tokens: 10 }),
      row({ provider: "elevenlabs", char_count: 10 }),
    ]);
    assert.equal(totals.openrouter.chars, 0);
    assert.equal(totals.elevenlabs.inputTokens, 0);
  });
});

describe("pivotDailyByProvider", () => {
  const row = (over: Partial<DailyRow>): DailyRow => ({
    day: "2026-08-01",
    provider: "openrouter",
    cost_idr: 0,
    cost_usd: 0,
    char_count: 0,
    event_count: 0,
    ...over,
  });

  it("buckets openrouter and elevenlabs costs into the same day row", () => {
    const pivoted = pivotDailyByProvider([
      row({ day: "2026-08-01", provider: "openrouter", cost_idr: 1000, cost_usd: 0.06 }),
      row({ day: "2026-08-01", provider: "elevenlabs", cost_idr: 2000, cost_usd: 0.11 }),
    ]);
    assert.equal(pivoted.length, 1);
    assert.equal(pivoted[0].openrouter, 1000);
    assert.equal(pivoted[0].elevenlabs, 2000);
    assert.equal(pivoted[0].openrouterUsd, 0.06);
    assert.equal(pivoted[0].elevenlabsUsd, 0.11);
  });

  it("sums multiple rows for the same day and provider", () => {
    const pivoted = pivotDailyByProvider([
      row({ day: "2026-08-01", provider: "openrouter", cost_idr: 100 }),
      row({ day: "2026-08-01", provider: "openrouter", cost_idr: 200 }),
    ]);
    assert.equal(pivoted[0].openrouter, 300);
  });

  it("sorts output rows chronologically regardless of input order", () => {
    const pivoted = pivotDailyByProvider([
      row({ day: "2026-08-03" }),
      row({ day: "2026-08-01" }),
      row({ day: "2026-08-02" }),
    ]);
    assert.deepEqual(pivoted.map((r) => r.day), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("ignores an unrecognized provider without throwing", () => {
    const pivoted = pivotDailyByProvider([row({ provider: "some-future-provider" as any, cost_idr: 999 })]);
    assert.equal(pivoted[0].openrouter, 0);
    assert.equal(pivoted[0].elevenlabs, 0);
  });

  it("returns an empty array for no rows", () => {
    assert.deepEqual(pivotDailyByProvider([]), []);
  });
});

describe("weekStartKeyUTC", () => {
  it("returns the same Monday for every day Mon-Sun in that week", () => {
    // 2026-08-03 is a Monday (UTC).
    const monday = "2026-08-03";
    const daysOfThatWeek = [
      "2026-08-03T00:00:00Z", // Mon
      "2026-08-04T12:00:00Z", // Tue
      "2026-08-05T23:59:59Z", // Wed
      "2026-08-06T06:00:00Z", // Thu
      "2026-08-07T18:00:00Z", // Fri
      "2026-08-08T00:00:01Z", // Sat
      "2026-08-09T23:00:00Z", // Sun
    ];
    for (const iso of daysOfThatWeek) {
      assert.equal(weekStartKeyUTC(new Date(iso)), monday, `${iso} should map to ${monday}`);
    }
  });

  it("rolls a Sunday back to the previous Monday, not forward", () => {
    assert.equal(weekStartKeyUTC(new Date("2026-08-09T12:00:00Z")), "2026-08-03");
  });

  it("handles a week that crosses a month boundary", () => {
    // 2026-08-31 is a Monday (UTC); the following Sunday is 2026-09-06.
    assert.equal(weekStartKeyUTC(new Date("2026-09-06T10:00:00Z")), "2026-08-31");
  });

  it("handles a week that crosses a year boundary", () => {
    // 2025-12-29 is a Monday (UTC).
    assert.equal(weekStartKeyUTC(new Date("2026-01-01T00:00:00Z")), "2025-12-29");
  });
});

describe("summarizeAppWindow", () => {
  const now = new Date("2026-08-07T15:00:00Z"); // Friday, week start 2026-08-03, month start 2026-08-01

  const row = (over: Partial<DailyRow>): DailyRow => ({
    day: "2026-08-01",
    provider: "elevenlabs",
    cost_idr: 0,
    cost_usd: 0,
    char_count: 0,
    event_count: 0,
    ...over,
  });

  it("splits today/week/month sums correctly relative to `now`", () => {
    const rows = [
      row({ day: "2026-07-15", cost_usd: 1, char_count: 100 }), // before this month — excluded from all
      row({ day: "2026-08-01", cost_usd: 2, char_count: 200 }), // this month, before this week
      row({ day: "2026-08-05", cost_usd: 3, char_count: 300 }), // this week, not today
      row({ day: "2026-08-07", cost_usd: 4, char_count: 400 }), // today
    ];
    const result = summarizeAppWindow(rows, "elevenlabs", now);
    assert.equal(result.today, 4);
    assert.equal(result.week, 7); // 3 + 4
    assert.equal(result.month, 9); // 2 + 3 + 4
    assert.equal(result.charsToday, 400);
    assert.equal(result.charsWeek, 700);
    assert.equal(result.charsMonth, 900);
  });

  it("filters out rows from a different provider", () => {
    const rows = [row({ provider: "openrouter", day: "2026-08-07", cost_usd: 99, char_count: 999 })];
    const result = summarizeAppWindow(rows, "elevenlabs", now);
    assert.equal(result.today, 0);
    assert.equal(result.charsToday, 0);
  });

  it("returns all zeros for an empty row set", () => {
    const result = summarizeAppWindow([], "elevenlabs", now);
    assert.deepEqual(result, { today: 0, week: 0, month: 0, charsToday: 0, charsWeek: 0, charsMonth: 0 });
  });
});

describe("computeDrift", () => {
  it("flags 'no-baseline' when the live/provider value is zero or negative", () => {
    assert.deepEqual(computeDrift(100, 0), { status: "no-baseline", diffPct: null });
    assert.deepEqual(computeDrift(100, -5), { status: "no-baseline", diffPct: null });
  });

  it("flags 'aligned' when within 5% of the live value", () => {
    const result = computeDrift(104, 100);
    assert.equal(result.status, "aligned");
    assert.equal(result.diffPct, 0.04);
  });

  it("flags 'drifted' once the gap reaches 5% or more", () => {
    const result = computeDrift(106, 100);
    assert.equal(result.status, "drifted");
    assert.equal(result.diffPct, 0.06);
  });

  it("is symmetric — app-under-live and app-over-live drift the same amount", () => {
    assert.equal(computeDrift(50, 100).diffPct, computeDrift(150, 100).diffPct);
  });

  it("flags 'aligned' for an exact match", () => {
    assert.deepEqual(computeDrift(100, 100), { status: "aligned", diffPct: 0 });
  });
});

describe("per-organization usage breakdown", () => {
  const orgRow = (over: Partial<DailyOrgRow>): DailyOrgRow => ({
    day: "2026-08-01",
    organization_id: "org-a",
    provider: "openrouter",
    cost_idr: 0,
    cost_usd: 0,
    char_count: 0,
    event_count: 0,
    ...over,
  });

  // A realistic 3-org fixture: org-a is the clear top spender, org-b is
  // mid-sized, org-c barely uses the platform — used across the describe
  // blocks below to check the different orgs stay correctly distinguished
  // (not silently merged) at every stage of the pipeline.
  const threeOrgRows: DailyOrgRow[] = [
    orgRow({ day: "2026-08-01", organization_id: "org-a", provider: "openrouter", cost_idr: 10_000, cost_usd: 0.6 }),
    orgRow({ day: "2026-08-01", organization_id: "org-a", provider: "elevenlabs", cost_idr: 5_000, cost_usd: 0.3, char_count: 400 }),
    orgRow({ day: "2026-08-02", organization_id: "org-a", provider: "openrouter", cost_idr: 8_000, cost_usd: 0.5 }),
    orgRow({ day: "2026-08-01", organization_id: "org-b", provider: "openrouter", cost_idr: 3_000, cost_usd: 0.18 }),
    orgRow({ day: "2026-08-02", organization_id: "org-b", provider: "elevenlabs", cost_idr: 2_000, cost_usd: 0.12, char_count: 150 }),
    orgRow({ day: "2026-08-02", organization_id: "org-c", provider: "openrouter", cost_idr: 100, cost_usd: 0.006 }),
  ];

  describe("summarizeCostByOrg", () => {
    it("sums cost/events per org across days and providers without mixing orgs", () => {
      const totals = summarizeCostByOrg(threeOrgRows);
      assert.equal(totals["org-a"].costIdr, 23_000); // 10k + 5k + 8k
      assert.equal(totals["org-a"].costUsd, 1.4);
      assert.equal(totals["org-b"].costIdr, 5_000);
      assert.equal(totals["org-c"].costIdr, 100);
      assert.equal(Object.keys(totals).length, 3);
    });

    it("returns an empty object for no rows", () => {
      assert.deepEqual(summarizeCostByOrg([]), {});
    });

    it("keeps a single-event org from contaminating another org's total", () => {
      const totals = summarizeCostByOrg([
        orgRow({ organization_id: "org-x", cost_idr: 1 }),
        orgRow({ organization_id: "org-y", cost_idr: 999_999 }),
      ]);
      assert.equal(totals["org-x"].costIdr, 1);
      assert.equal(totals["org-y"].costIdr, 999_999);
    });
  });

  describe("topOrgIdsByCost", () => {
    it("ranks orgs highest-cost-first by IDR", () => {
      const totals = summarizeCostByOrg(threeOrgRows);
      assert.deepEqual(topOrgIdsByCost(totals, 2, "idr"), ["org-a", "org-b"]);
    });

    it("ranks orgs by USD when currency is 'usd', independent of the IDR ranking", () => {
      const totals = summarizeCostByOrg(threeOrgRows);
      assert.deepEqual(topOrgIdsByCost(totals, 3, "usd"), ["org-a", "org-b", "org-c"]);
    });

    it("returns every org (not just N) when there are fewer orgs than N", () => {
      const totals = summarizeCostByOrg(threeOrgRows);
      assert.equal(topOrgIdsByCost(totals, 10, "idr").length, 3);
    });

    it("returns an empty array when n is 0", () => {
      const totals = summarizeCostByOrg(threeOrgRows);
      assert.deepEqual(topOrgIdsByCost(totals, 0, "idr"), []);
    });

    it("breaks exact-cost ties deterministically by organization_id", () => {
      const totals = { "org-z": { costIdr: 100, costUsd: 0, events: 0 }, "org-a": { costIdr: 100, costUsd: 0, events: 0 } };
      assert.deepEqual(topOrgIdsByCost(totals, 2, "idr"), ["org-a", "org-z"]);
    });
  });

  describe("pivotDailyByOrg", () => {
    it("keeps top orgs in separate columns per day, distinct from each other", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, ["org-a", "org-b"]);
      const day1 = pivoted.find((r) => r.day === "2026-08-01")!;
      assert.equal(day1[orgSeriesKey("org-a")], 15_000); // 10k openrouter + 5k elevenlabs
      assert.equal(day1[orgSeriesKey("org-b")], 3_000);
    });

    it("folds every org outside topOrgIds into a single 'other' column", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, ["org-a"]);
      const day2 = pivoted.find((r) => r.day === "2026-08-02")!;
      // org-b (2000) + org-c (100) on day 2, neither in the top-1 list.
      assert.equal(day2.other, 2_100);
      assert.equal(day2[orgSeriesKey("org-b")], undefined);
    });

    it("also pivots the USD figures per org, independent of the IDR columns", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, ["org-a", "org-b"]);
      const day1 = pivoted.find((r) => r.day === "2026-08-01")!;
      assert.ok(Math.abs((day1[`${orgSeriesKey("org-a")}Usd`] as number) - 0.9) < 1e-9); // 0.6 + 0.3
      assert.equal(day1[`${orgSeriesKey("org-b")}Usd`], 0.18);
    });

    it("fills an explicit 0 (not undefined) for a top org that had zero usage that day", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, ["org-a", "org-b", "org-c"]);
      const day1 = pivoted.find((r) => r.day === "2026-08-01")!;
      // org-c only appears on day 2, so day 1 must still carry an explicit 0.
      assert.equal(day1[orgSeriesKey("org-c")], 0);
    });

    it("sorts output rows chronologically", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, ["org-a"]);
      assert.deepEqual(pivoted.map((r) => r.day), ["2026-08-01", "2026-08-02"]);
    });

    it("returns an empty array for no rows", () => {
      assert.deepEqual(pivotDailyByOrg([], ["org-a"]), []);
    });

    it("with an empty topOrgIds list, buckets every org into 'other'", () => {
      const pivoted = pivotDailyByOrg(threeOrgRows, []);
      const day1 = pivoted.find((r) => r.day === "2026-08-01")!;
      assert.equal(day1.other, 18_000); // org-a 15k + org-b 3k
    });
  });

  describe("orgSeriesKey", () => {
    it("prefixes the org id so it can't collide with reserved chart keys like 'day' or 'other'", () => {
      assert.equal(orgSeriesKey("abc-123"), "org_abc-123");
      assert.notEqual(orgSeriesKey("other"), "other");
      assert.notEqual(orgSeriesKey("day"), "day");
    });
  });
});
