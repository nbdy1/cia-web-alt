import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalise,
  sanitizeFreeText,
  parseModelJson,
  buildFallbackTitle,
  normalizeReportTitle,
  canonicalCategory,
  lookupCanonicalIndicator,
  isLikelySameSubIndicator,
  enrichDetailedAssessments,
  enrichTreatment,
  computeOverallStats,
  expandKnowledgeQuery,
  formatKnowledgeContext,
  formatCriteriaContext,
  getRecentTranscriptWindow,
  buildUnexploredThemesContext,
} from "../lib/ai/assessment-helpers";
import { karakterData } from "../lib/data/karakter";

// Real framework fixtures (lib/data/karakter.ts, theme 1) — using real data
// instead of invented strings so these tests fail if the framework file
// itself changes shape, not just if the enrichment logic breaks.
const THEME_1 = karakterData.themes[0];
const IND_CITA_CITA = THEME_1.indicators[0]; // "Punya cita-cita yang teguh" — 2 subs
const IND_KEPUTUSAN = THEME_1.indicators[1]; // "Keputusan yang ia buat..." — 3 subs

describe("normalise", () => {
  it("trims and lowercases", () => {
    assert.equal(normalise("  Karakter  "), "karakter");
  });
});

describe("sanitizeFreeText", () => {
  it("returns empty string for falsy input", () => {
    assert.equal(sanitizeFreeText(""), "");
  });

  it("strips markdown code fences", () => {
    assert.equal(sanitizeFreeText("before ```json\n{\"a\":1}\n``` after"), "before after");
  });

  it("strips wiki-link-style double brackets", () => {
    assert.equal(sanitizeFreeText("Santri [[menunjukkan]] kemajuan"), "Santri menunjukkan kemajuan");
  });

  it("strips a whole-string bracket/brace wrapping", () => {
    assert.equal(sanitizeFreeText("[Santri menunjukkan kemajuan]"), "Santri menunjukkan kemajuan");
    assert.equal(sanitizeFreeText("{Santri menunjukkan kemajuan}"), "Santri menunjukkan kemajuan");
  });

  it("strips leftover JSON key fragments", () => {
    assert.equal(sanitizeFreeText('"status_summary": Santri menunjukkan kemajuan'), "Santri menunjukkan kemajuan");
  });

  it("collapses internal whitespace", () => {
    assert.equal(sanitizeFreeText("Santri   menunjukkan\n\nkemajuan"), "Santri menunjukkan kemajuan");
  });

  it("leaves already-clean prose untouched", () => {
    assert.equal(sanitizeFreeText("Santri menunjukkan kemajuan pesat."), "Santri menunjukkan kemajuan pesat.");
  });
});

describe("parseModelJson", () => {
  it("parses clean JSON", () => {
    assert.deepEqual(parseModelJson('{"a":1}', "test"), { a: 1 });
  });

  it("parses JSON wrapped in a markdown fence", () => {
    assert.deepEqual(parseModelJson('```json\n{"a":1}\n```', "test"), { a: 1 });
  });

  it("extracts the first balanced JSON value from noisy trailing text", () => {
    assert.deepEqual(
      parseModelJson('{"a":1} some trailing note from the model', "test"),
      { a: 1 },
    );
  });

  it("throws when the response contains no JSON at all", () => {
    assert.throws(() => parseModelJson("no json here", "test"), SyntaxError);
  });

  it("throws when the JSON is incomplete", () => {
    assert.throws(() => parseModelJson('{"a": 1, "b":', "test"), SyntaxError);
  });
});

describe("buildFallbackTitle", () => {
  it("prefers the treatment priority theme", () => {
    assert.equal(
      buildFallbackTitle({ treatment: { priority_theme: "Kedisiplinan" } }),
      "Fokus Kedisiplinan",
    );
  });

  it("falls back to the first 6 words of status_summary", () => {
    const title = buildFallbackTitle({
      status_summary: "Santri menunjukkan perkembangan pesat dalam banyak aspek kehidupan sehari-hari",
    });
    assert.equal(title.split(" ").length, 6);
  });

  it("falls back to a generic title when nothing is available", () => {
    assert.equal(buildFallbackTitle({}), "Laporan Perkembangan");
  });
});

describe("normalizeReportTitle", () => {
  it("strips quotes and caps at 6 words", () => {
    assert.equal(
      normalizeReportTitle(`"Menumbuhkan Kedewasaan dan Sikap Tanggung Jawab Setiap Hari"`, {}),
      "Menumbuhkan Kedewasaan dan Sikap Tanggung Jawab",
    );
  });

  it("falls back when the raw title is empty", () => {
    assert.equal(
      normalizeReportTitle("", { treatment: { priority_theme: "Kedisiplinan" } }),
      "Fokus Kedisiplinan",
    );
  });

  it("falls back when the raw title is not a string", () => {
    assert.equal(normalizeReportTitle(undefined, {}), "Laporan Perkembangan");
  });
});

describe("canonicalCategory", () => {
  it("matches case-insensitively", () => {
    assert.equal(canonicalCategory("karakter"), "Karakter");
    assert.equal(canonicalCategory("KARAKTER"), "Karakter");
    assert.equal(canonicalCategory("soft skill"), "Soft Skill");
  });

  it("returns null for an unknown category", () => {
    assert.equal(canonicalCategory("Akademik"), null);
  });
});

describe("lookupCanonicalIndicator", () => {
  it("finds a real theme/indicator case-insensitively", () => {
    const result = lookupCanonicalIndicator(
      "karakter",
      THEME_1.title.toUpperCase(),
      IND_CITA_CITA.title,
    );
    assert.ok(result);
    assert.equal(result?.category, "Karakter");
    assert.equal(result?.theme, THEME_1.title);
    assert.equal(result?.indicator, IND_CITA_CITA.title);
    assert.deepEqual(result?.subIndicators, IND_CITA_CITA.sub_indicators);
  });

  it("returns null for an indicator that doesn't exist", () => {
    assert.equal(
      lookupCanonicalIndicator("Karakter", THEME_1.title, "Indikator yang tidak ada"),
      null,
    );
  });

  it("returns null for an unknown category", () => {
    assert.equal(
      lookupCanonicalIndicator("Akademik", THEME_1.title, IND_CITA_CITA.title),
      null,
    );
  });
});

describe("isLikelySameSubIndicator", () => {
  it("matches identical strings", () => {
    assert.equal(isLikelySameSubIndicator("Rajin belajar", "Rajin belajar"), true);
  });

  it("matches when one string contains the other", () => {
    assert.equal(isLikelySameSubIndicator("Santri rajin belajar setiap hari", "Rajin belajar"), true);
    assert.equal(isLikelySameSubIndicator("Rajin belajar", "Santri rajin belajar setiap hari"), true);
  });

  it("does not match unrelated strings", () => {
    assert.equal(isLikelySameSubIndicator("Rajin belajar", "Suka bermain game"), false);
  });
});

describe("enrichDetailedAssessments", () => {
  it("canonicalizes fuzzy-matched fulfilled sub-indicators against the framework", () => {
    const [result] = enrichDetailedAssessments([
      {
        category: "karakter",
        theme: THEME_1.title,
        indicator: IND_CITA_CITA.title,
        fulfilled_sub_indicators: [IND_CITA_CITA.sub_indicators[0].slice(0, 20)], // fuzzy/partial match
        reasoning: "Terlihat jelas dari observasi.",
      },
    ]);

    assert.equal(result.category, "Karakter");
    assert.deepEqual(result.fulfilled_sub_indicators, [IND_CITA_CITA.sub_indicators[0]]);
    assert.equal(result.fulfillment_fraction, `1/${IND_CITA_CITA.sub_indicators.length}`);
    assert.deepEqual(
      result.missing_sub_indicators,
      IND_CITA_CITA.sub_indicators.slice(1),
    );
  });

  it("drops items whose theme/indicator don't match the framework", () => {
    const result = enrichDetailedAssessments([
      { category: "Karakter", theme: "Tema fiktif", indicator: "Indikator fiktif", fulfilled_sub_indicators: [] },
    ]);
    assert.deepEqual(result, []);
  });

  it("deduplicates repeated category/theme/indicator entries", () => {
    const result = enrichDetailedAssessments([
      { category: "Karakter", theme: THEME_1.title, indicator: IND_CITA_CITA.title, fulfilled_sub_indicators: [] },
      { category: "Karakter", theme: THEME_1.title, indicator: IND_CITA_CITA.title, fulfilled_sub_indicators: [IND_CITA_CITA.sub_indicators[0]] },
    ]);
    assert.equal(result.length, 1);
    // First occurrence wins; the second (with a fulfilled sub) is discarded.
    assert.deepEqual(result[0].fulfilled_sub_indicators, []);
  });

  it("keeps declined_sub_indicators mutually exclusive with fulfilled_sub_indicators in the same report", () => {
    const sub = IND_CITA_CITA.sub_indicators[0];
    const [result] = enrichDetailedAssessments([
      {
        category: "Karakter",
        theme: THEME_1.title,
        indicator: IND_CITA_CITA.title,
        fulfilled_sub_indicators: [sub],
        declined_sub_indicators: [sub], // AI (incorrectly) proposed the same sub as both
      },
    ]);
    assert.deepEqual(result.fulfilled_sub_indicators, [sub]);
    assert.deepEqual(result.declined_sub_indicators, []);
  });

  it("canonicalizes declined_sub_indicators independently when there's no overlap", () => {
    const [result] = enrichDetailedAssessments([
      {
        category: "Karakter",
        theme: THEME_1.title,
        indicator: IND_CITA_CITA.title,
        fulfilled_sub_indicators: [],
        declined_sub_indicators: [IND_CITA_CITA.sub_indicators[1]],
      },
    ]);
    assert.deepEqual(result.declined_sub_indicators, [IND_CITA_CITA.sub_indicators[1]]);
  });

  it("sanitizes the reasoning field", () => {
    const [result] = enrichDetailedAssessments([
      {
        category: "Karakter",
        theme: THEME_1.title,
        indicator: IND_CITA_CITA.title,
        fulfilled_sub_indicators: [],
        reasoning: '"reasoning": Terlihat  jelas   dari observasi.',
      },
    ]);
    assert.equal(result.reasoning, "Terlihat jelas dari observasi.");
  });
});

describe("enrichTreatment", () => {
  it("pins priority_theme/indicator to the canonical matched assessment and derives targets deterministically", () => {
    const enrichedAssessments = enrichDetailedAssessments([
      {
        category: "Karakter",
        theme: THEME_1.title,
        indicator: IND_KEPUTUSAN.title,
        fulfilled_sub_indicators: [IND_KEPUTUSAN.sub_indicators[0]],
      },
    ]);

    const result = enrichTreatment(
      {
        priority_theme: THEME_1.title,
        priority_indicator: IND_KEPUTUSAN.title,
        target_sub_indicators: [],
        action_plan: "Rencana penanganan.",
      },
      enrichedAssessments,
    );

    assert.equal(result.priority_theme, THEME_1.title);
    assert.equal(result.priority_indicator, IND_KEPUTUSAN.title);
    // Missing subs = subs 1 and 2 (sub 0 was fulfilled)
    assert.deepEqual(result.target_sub_indicators, IND_KEPUTUSAN.sub_indicators.slice(1));
  });

  it("caps deterministic targets at 3", () => {
    // theme 1's 6th indicator has 4 sub-indicators, none fulfilled — a real
    // case where missing_sub_indicators.length > 3 to exercise the slice(0, 3) cap.
    const indWithFourSubs = THEME_1.indicators.find((i) => i.sub_indicators.length >= 4)!;
    const enrichedAssessments = enrichDetailedAssessments([
      {
        category: "Karakter",
        theme: THEME_1.title,
        indicator: indWithFourSubs.title,
        fulfilled_sub_indicators: [],
      },
    ]);

    const result = enrichTreatment(
      {
        priority_theme: THEME_1.title,
        priority_indicator: indWithFourSubs.title,
        target_sub_indicators: [],
        action_plan: "",
      },
      enrichedAssessments,
    );

    assert.ok(result.target_sub_indicators.length <= 3);
  });

  it("falls back to raw target_sub_indicators when no assessment matches", () => {
    const result = enrichTreatment(
      {
        priority_theme: "Tema fiktif",
        priority_indicator: "Indikator fiktif",
        target_sub_indicators: ["Sesuatu"],
        action_plan: "Rencana.",
      },
      [],
    );
    assert.deepEqual(result.target_sub_indicators, ["Sesuatu"]);
    assert.equal(result.priority_theme, "Tema fiktif");
  });

  it("sanitizes action_plan", () => {
    const result = enrichTreatment(
      { priority_theme: "x", priority_indicator: "y", action_plan: "[[Rencana]] penanganan." },
      [],
    );
    assert.equal(result.action_plan, "Rencana penanganan.");
  });

  it("passes through non-object treatment values unchanged", () => {
    assert.equal(enrichTreatment(null, []), null);
    assert.equal(enrichTreatment(undefined, []), undefined);
  });
});

describe("computeOverallStats", () => {
  it("counts fulfilled sub-indicators against the full local framework, not just what's in detailed_assessments", () => {
    const stats = computeOverallStats({
      detailed_assessments: [
        {
          category: "Karakter",
          theme: THEME_1.title,
          indicator: IND_CITA_CITA.title,
          fulfilled_sub_indicators: [IND_CITA_CITA.sub_indicators[0]],
        },
      ],
    });

    assert.equal(stats.karakter.fulfilled, 1);
    assert.ok(stats.karakter.total > IND_CITA_CITA.sub_indicators.length, "total should span the whole framework, not just this indicator");
    assert.equal(stats.mental.fulfilled, 0);
    assert.equal(stats.soft_skill.fulfilled, 0);
  });

  it("returns zeroed stats for empty input", () => {
    const stats = computeOverallStats({ detailed_assessments: [] });
    assert.equal(stats.karakter.fulfilled, 0);
    assert.equal(stats.karakter.percentage, 0);
  });
});

describe("expandKnowledgeQuery", () => {
  it("strips a speaker prefix", () => {
    assert.equal(expandKnowledgeQuery("Guru: Apa itu 3PFB?").startsWith("Apa itu 3PFB?"), true);
  });

  it("expands question-like queries with domain context", () => {
    const expanded = expandKnowledgeQuery("Jelaskan makna jihad");
    assert.ok(expanded.includes("Jelaskan makna jihad"));
    assert.ok(expanded.length > "Jelaskan makna jihad".length);
  });

  it("passes through non-question queries mostly unchanged", () => {
    assert.equal(expandKnowledgeQuery("Santri rajin sholat berjamaah"), "Santri rajin sholat berjamaah");
  });
});

describe("formatKnowledgeContext / formatCriteriaContext", () => {
  it("returns empty string for no knowledge rows", () => {
    assert.equal(formatKnowledgeContext([]), "");
  });

  it("strips the ingest section prefix from knowledge content", () => {
    const out = formatKnowledgeContext([
      { id: 1, section: "Dasar Teori", content: "[Dasar Teori]\nIsi materi.", page_start: 4, similarity: 0.9 },
    ]);
    assert.ok(out.includes("Isi materi."));
    assert.ok(!out.includes("[Dasar Teori]\nIsi"));
  });

  it("groups criteria rows by category > theme > indicator", () => {
    const out = formatCriteriaContext([
      { category: "Karakter", theme: "Tema A", indicator: "Indikator A", sub_indicator: "Sub 1", similarity: 0.9 },
      { category: "Karakter", theme: "Tema A", indicator: "Indikator A", sub_indicator: "Sub 2", similarity: 0.8 },
    ]);
    assert.ok(out.includes("## Kategori: Karakter"));
    assert.ok(out.includes("### Tema: Tema A"));
    assert.ok(out.includes("Indikator: Indikator A"));
    assert.ok(out.includes("- Sub 1"));
    assert.ok(out.includes("- Sub 2"));
  });
});

describe("getRecentTranscriptWindow", () => {
  it("returns only the last N non-empty lines", () => {
    const transcript = "Guru: a\nAI: b\nGuru: c\nAI: d\nGuru: e";
    assert.equal(getRecentTranscriptWindow(transcript, 2), "AI: d\nGuru: e");
  });

  it("drops blank lines", () => {
    assert.equal(getRecentTranscriptWindow("a\n\n\nb", 5), "a\nb");
  });
});

describe("buildUnexploredThemesContext", () => {
  it("excludes themes already discovered or already in the frontier", () => {
    const context = buildUnexploredThemesContext(
      [{ category: "Karakter", theme: THEME_1.title, indicator: "x", sub_indicator: "y", similarity: 1 }],
      [],
      50,
    );
    assert.ok(!context.includes(THEME_1.title));
  });

  it("respects the limit", () => {
    const context = buildUnexploredThemesContext([], [], 2);
    const lines = context.split("\n").filter(Boolean);
    assert.equal(lines.length, 2);
  });
});
