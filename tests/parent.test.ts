import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeParentCode,
  normalizeParentCodes,
  validateParentSignup,
  validateParentCodes,
  sanitizeCards,
  sanitizePeriod,
  sanitizeObserved,
  sanitizeEditedContent,
  detectSensitive,
  trendLabel,
  computeTrends,
  dominantAspect,
  digestReportForParent,
} from "../lib/parent";

test("normalizeParentCode accepts loose input and formats XXXX-XXXX", () => {
  assert.equal(normalizeParentCode("k7m2 9qxa"), "K7M2-9QXA");
  assert.equal(normalizeParentCode("K7M29QXA"), "K7M2-9QXA");
});

test("normalizeParentCode rejects look-alike characters and wrong length", () => {
  assert.equal(normalizeParentCode("K7M2-9QX0"), null);
  assert.equal(normalizeParentCode("K7M2-9QXI"), null);
  assert.equal(normalizeParentCode("K7M2"), null);
  assert.equal(normalizeParentCode(null), null);
});

test("normalizeParentCodes dedupes, skips blanks and reports invalid", () => {
  const r = normalizeParentCodes(["k7m2-9qxa", "K7M29QXA", "", "nope"]);
  assert.deepEqual(r.valid, ["K7M2-9QXA"]);
  assert.deepEqual(r.invalid, ["nope"]);
});

test("validateParentCodes needs at least one valid code", () => {
  assert.equal(validateParentCodes([]).valid, false);
  assert.equal(validateParentCodes(["bad"]).valid, false);
  assert.equal(validateParentCodes(["K7M2-9QXA"]).valid, true);
});

test("validateParentSignup requires a code, a real email and a long password", () => {
  const base = { name: "Bu Siti", email: "Siti@Example.com", password: "password123", codes: ["K7M2-9QXA"] };
  const ok = validateParentSignup(base);
  assert.equal(ok.valid, true);
  if (ok.valid) assert.equal(ok.email, "siti@example.com");
  assert.equal(validateParentSignup({ ...base, codes: [] }).valid, false);
  assert.equal(validateParentSignup({ ...base, email: "x" }).valid, false);
  assert.equal(validateParentSignup({ ...base, password: "short" }).valid, false);
});

test("sanitizeCards keeps one card per kind, always gives an action and fills defaults", () => {
  const out = sanitizeCards(
    {
      cards: [
        { kind: "kabar_baik", aspect: "karakter", text: " Alhamdulillah rajin ", actions: [] },
        { kind: "kabar_baik", aspect: "mental", text: "duplikat", actions: ["x"] },
        { kind: "didampingi", aspect: "bogus", text: "Sedang dibina", focus: "Ishlah", actions: ["a", "b", "c"] },
      ],
      sensitive: true,
      sensitive_reason: "konflik",
    },
    "soft_skill",
  );
  assert.equal(out.cards.length, 2);
  assert.equal(out.cards[0].content.text, "Alhamdulillah rajin");
  assert.ok(out.cards[0].content.actions.length >= 1);
  assert.equal(out.cards[1].aspect, "soft_skill"); // invalid aspect falls back
  assert.equal(out.cards[1].content.duration, "2 minggu");
  assert.equal(out.cards[1].content.actions.length, 2);
  assert.equal(out.sensitive, true);
  assert.throws(() => sanitizeCards({ cards: [] }, "karakter"));
});

test("sanitizeObserved only keeps behaviours tied to real report themes", () => {
  const raw = [{ theme: "Mandiri.", text: " Merapikan kamar " }, { theme: "Tema karangan", text: "x" }, { theme: "Mandiri.", text: "" }];
  assert.deepEqual(sanitizeObserved(raw, ["Mandiri."]), [{ theme: "Mandiri.", text: "Merapikan kamar" }]);
  assert.equal(sanitizeObserved(raw).length, 2); // no allow-list: only blanks are dropped
  assert.deepEqual(sanitizeObserved(null), []);
});

test("sanitizePeriod needs an overview and makes the profile optional", () => {
  const out = sanitizePeriod({ summary: { overview: "Baik", strengths: ["a"] } });
  assert.equal(out.profile, null);
  assert.throws(() => sanitizePeriod({ summary: {} }));
  const withProfile = sanitizePeriod({ summary: { overview: "Baik" }, profile: { overview: "Gambaran", best_approach: ["x"] } });
  assert.deepEqual(withProfile.profile?.best_approach, ["x"]);
});

test("sanitizeEditedContent trims musyrif edits and rejects empty text", () => {
  const u = sanitizeEditedContent("update", { text: "  Halo  ", actions: ["a", "", "b", "c"] }) as any;
  assert.equal(u.text, "Halo");
  assert.deepEqual(u.actions, ["a", "b"]);
  assert.throws(() => sanitizeEditedContent("update", { text: " " }));
});

test("detectSensitive flags conflict and heavy emotion, not ordinary progress", () => {
  assert.equal(detectSensitive("Fadhil berkelahi dengan teman sekamar").sensitive, true);
  assert.equal(detectSensitive("Sering menangis setiap malam").sensitive, true);
  assert.equal(detectSensitive("Rajin salat berjamaah dan sopan").sensitive, false);
});

test("trendLabel: Baru dimulai without a previous period, otherwise by fractions of a point", () => {
  assert.equal(trendLabel(null), "Baru dimulai");
  assert.equal(trendLabel(0.3), "Berkembang");
  assert.equal(trendLabel(0.2), "Konsisten");
  assert.equal(trendLabel(-0.2), "Konsisten");
  assert.equal(trendLabel(-0.3), "Perlu Dampingan");
});

test("computeTrends compares the period only with the one before it", () => {
  const plan = (k: number) => ({ overall_stats: { karakter: { percentage: k }, mental: { percentage: 1 }, soft_skill: { percentage: 4 } } });
  const reports = [
    { created_at: "2026-11-20T00:00:00Z", treatment_plan: plan(4) },
    { created_at: "2026-11-05T00:00:00Z", treatment_plan: JSON.stringify(plan(3)) },
    { created_at: "2026-10-20T00:00:00Z", treatment_plan: plan(2) },
  ];
  const t = computeTrends(reports, { startIso: "2026-11-01T00:00:00Z", endIso: "2026-12-01T00:00:00Z" });
  assert.equal(t[0].label, "Berkembang"); // 4 vs 2
  assert.equal(t[0].percentage, 4);
  assert.equal(t[1].label, "Konsisten"); // 1 vs 1
  const first = computeTrends(reports.slice(2), { startIso: "2026-10-01T00:00:00Z", endIso: "2026-11-01T00:00:00Z" });
  assert.equal(first[0].label, "Baru dimulai");
});

test("dominantAspect follows the priority treatment theme", () => {
  const plan = {
    treatment: { priority_theme: "Sabar" },
    detailed_assessments: [{ category: "Karakter", theme: "Jujur" }, { category: "Soft Skill", theme: "Sabar" }],
  };
  assert.equal(dominantAspect(plan), "soft_skill");
});

test("digestReportForParent never includes the interview transcript", () => {
  const digest = digestReportForParent(
    { id: "1", title: "t", created_at: "2026-11-01T00:00:00Z", treatment_plan: { status_summary: "Baik", narrative: "RAHASIA TRANSKRIP", detailed_assessments: [] } },
    0,
  );
  assert.ok(digest.includes("Baik"));
  assert.ok(!digest.includes("RAHASIA"));
});
