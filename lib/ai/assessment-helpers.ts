/**
 * lib/ai/assessment-helpers.ts
 *
 * Pure, deterministic post-processing logic used by app/actions/ai-analysis.ts
 * to sanitize and validate AI-generated assessment output. Extracted into a
 * plain module (no "use server", no network/DB calls) so it can be:
 *   1. Unit tested directly — see tests/assessment-helpers.test.ts.
 *   2. Kept out of app/actions/ai-analysis.ts, which has a "use server"
 *      directive — every export from a "use server" file is treated as a
 *      Server Function and MUST be async, so these sync helpers can't live
 *      there as named exports.
 *
 * None of these functions call Supabase, OpenRouter, or any other I/O —
 * they only transform the AI's raw JSON against the local framework data
 * (lib/data/karakter.ts, mental.ts, soft-skill.ts), which is the source of
 * truth the app never trusts the AI to get right on its own (see the
 * "Deterministic Post-Processing" note in ai-analysis.ts).
 */

import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

export function normalise(s: string) {
  return s.trim().toLowerCase();
}

// Strips accidental JSON/markup artifacts (stray `[[...]]`, `{...}`, code
// fences, leftover `"key": ` fragments) that occasionally leak into free-text
// model output. This most often happens when a previously-corrupted
// profile_summary gets echoed back into the prompt as context and the model
// pattern-matches its formatting into the new response — see studentProfile
// sanitization in finalizeAssessment() and generateStudentProfile().
export function sanitizeFreeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[|\]\]/g, "")
    .replace(/^\s*[{[]+\s*|\s*[}\]]+\s*$/g, "")
    .replace(/"\s*[a-zA-Z_]+"\s*:\s*/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseModelJson(responseText: string, label: string) {
  const stripped = responseText
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // Some providers occasionally append notes after a valid JSON object even
    // when response_format is requested. Extract the first balanced JSON value.
  }

  const start = stripped.search(/[\[{]/);
  if (start === -1) {
    throw new SyntaxError(`${label}: model response did not contain JSON`);
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const char = stripped[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
    } else if (char === "}" || char === "]") {
      if (stack.pop() !== char) {
        break;
      }
      if (stack.length === 0) {
        return JSON.parse(stripped.slice(start, i + 1));
      }
    }
  }

  throw new SyntaxError(`${label}: model response contained incomplete JSON`);
}

export function buildFallbackTitle(parsed: any): string {
  const t = String(parsed?.treatment?.priority_theme ?? "").trim();
  if (t) return `Fokus ${t}`;
  const s = String(parsed?.status_summary ?? "").trim();
  if (!s) return "Laporan Perkembangan";
  const clean = s.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").slice(0, 6);
  return words.length > 0 ? words.join(" ") : "Laporan Perkembangan";
}

export function normalizeReportTitle(rawTitle: unknown, parsed: any): string {
  const source = typeof rawTitle === "string" ? sanitizeFreeText(rawTitle) : "";
  const cleaned = source
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6);
  if (words.length === 0) return buildFallbackTitle(parsed);
  return words.join(" ");
}

export interface OverallStats {
  fulfilled: number;
  total: number;
  percentage: number;
}

export const ALL_DATA_BY_CATEGORY: Record<
  string,
  { themes: { title: string; indicators: { title: string; sub_indicators: string[] }[] }[] }
> = {
  Karakter: karakterData,
  Mental: mentalData,
  "Soft Skill": softSkillData,
};

export function lookupFullIndicatorSubIndicators(
  category: string,
  themeTitle: string,
  indicatorTitle: string
): string[] | null {
  const catData = ALL_DATA_BY_CATEGORY[category];
  if (!catData) return null;

  for (const theme of catData.themes) {
    if (normalise(theme.title) !== normalise(themeTitle)) continue;
    for (const ind of theme.indicators) {
      if (normalise(ind.title) === normalise(indicatorTitle)) {
        return ind.sub_indicators;
      }
    }
  }
  return null;
}

export function canonicalCategory(category: string): string | null {
  return Object.keys(ALL_DATA_BY_CATEGORY).find(
    (k) => normalise(k) === normalise(category)
  ) ?? null;
}

export function lookupCanonicalIndicator(
  category: string,
  themeTitle: string,
  indicatorTitle: string
): { category: string; theme: string; indicator: string; subIndicators: string[] } | null {
  const canonicalCat = canonicalCategory(category);
  if (!canonicalCat) return null;
  const catData = ALL_DATA_BY_CATEGORY[canonicalCat];
  for (const theme of catData.themes) {
    if (normalise(theme.title) !== normalise(themeTitle)) continue;
    for (const ind of theme.indicators) {
      if (normalise(ind.title) === normalise(indicatorTitle)) {
        return {
          category: canonicalCat,
          theme: theme.title,
          indicator: ind.title,
          subIndicators: ind.sub_indicators,
        };
      }
    }
  }
  return null;
}

export function isLikelySameSubIndicator(candidate: string, target: string): boolean {
  const c = normalise(candidate);
  const t = normalise(target);
  return c === t || c.includes(t) || t.includes(c);
}

export function enrichDetailedAssessments(rawAssessments: any[]): any[] {
  const enriched: any[] = [];
  const seen = new Set<string>();

  for (const item of rawAssessments ?? []) {
    const canonical = lookupCanonicalIndicator(
      String(item?.category ?? ""),
      String(item?.theme ?? ""),
      String(item?.indicator ?? "")
    );
    if (!canonical) continue;

    const key = `${canonical.category}::${canonical.theme}::${canonical.indicator}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const aiFulfilled = Array.isArray(item?.fulfilled_sub_indicators)
      ? item.fulfilled_sub_indicators.map((s: any) => String(s))
      : [];
    const aiDeclined = Array.isArray(item?.declined_sub_indicators)
      ? item.declined_sub_indicators.map((s: any) => String(s))
      : [];

    const canonicalFulfilled = canonical.subIndicators.filter((frameworkSub) =>
      aiFulfilled.some((aiSub: string) => isLikelySameSubIndicator(aiSub, frameworkSub))
    );

    // A sub-indicator can't be both fulfilled and declined in the same report —
    // positive evidence in this session wins. Final "ever fulfilled before"
    // eligibility check happens later in finalizeAssessment(), once we can
    // query the student's report history.
    const canonicalDeclined = canonical.subIndicators.filter(
      (frameworkSub) =>
        aiDeclined.some((aiSub: string) => isLikelySameSubIndicator(aiSub, frameworkSub)) &&
        !canonicalFulfilled.some((fulfilledSub) => normalise(fulfilledSub) === normalise(frameworkSub))
    );

    const canonicalMissing = canonical.subIndicators.filter(
      (frameworkSub) =>
        !canonicalFulfilled.some((fulfilledSub) => normalise(fulfilledSub) === normalise(frameworkSub))
    );

    enriched.push({
      category: canonical.category,
      theme: canonical.theme,
      indicator: canonical.indicator,
      fulfilled_sub_indicators: canonicalFulfilled,
      declined_sub_indicators: canonicalDeclined,
      missing_sub_indicators: canonicalMissing,
      fulfillment_fraction: `${canonicalFulfilled.length}/${canonical.subIndicators.length}`,
      reasoning: sanitizeFreeText(String(item?.reasoning ?? "")),
    });
  }

  return enriched;
}

export function enrichTreatment(
  treatment: any,
  enrichedAssessments: any[]
): any {
  if (!treatment || typeof treatment !== "object") return treatment;

  const priorityTheme = String(treatment.priority_theme ?? "");
  const priorityIndicator = String(treatment.priority_indicator ?? "");
  const targetRaw = Array.isArray(treatment.target_sub_indicators)
    ? treatment.target_sub_indicators.map((s: any) => String(s))
    : [];

  const matchedAssessment = enrichedAssessments.find(
    (a) =>
      normalise(a.theme) === normalise(priorityTheme) &&
      normalise(a.indicator) === normalise(priorityIndicator)
  );

  const actionPlan = sanitizeFreeText(String(treatment.action_plan ?? ""));

  if (!matchedAssessment) {
    return {
      ...treatment,
      action_plan: actionPlan,
      target_sub_indicators: targetRaw,
    };
  }

  const deterministicTargets = matchedAssessment.missing_sub_indicators
    .filter((sub: string) =>
      targetRaw.length === 0
        ? true
        : targetRaw.some((t: string) => isLikelySameSubIndicator(t, sub))
    )
    .slice(0, 3);

  return {
    ...treatment,
    action_plan: actionPlan,
    priority_theme: matchedAssessment.theme,
    priority_indicator: matchedAssessment.indicator,
    target_sub_indicators:
      deterministicTargets.length > 0
        ? deterministicTargets
        : matchedAssessment.missing_sub_indicators.slice(0, 3),
  };
}

export function computeOverallStats(aiJson: any): {
  karakter: OverallStats;
  mental: OverallStats;
  soft_skill: OverallStats;
} {
  // 1. Collect canonical fulfilled sub-indicators per category by mapping the
  //    AI output back to the local framework indicator (theme+indicator scoped).
  const fulfilledByCategory: Record<string, Set<string>> = {
    Karakter: new Set(),
    Mental: new Set(),
    "Soft Skill": new Set(),
  };

  if (Array.isArray(aiJson.detailed_assessments)) {
    for (const assessment of aiJson.detailed_assessments) {
      const cat = assessment.category as string;
      const bucket =
        fulfilledByCategory[cat] ??
        fulfilledByCategory[Object.keys(fulfilledByCategory).find(
          (k) => normalise(k) === normalise(cat)
        ) ?? ""];
      if (!bucket) continue;

      const fullSubs = lookupFullIndicatorSubIndicators(
        cat,
        assessment.theme as string,
        assessment.indicator as string
      );

      if (!fullSubs || !Array.isArray(assessment.fulfilled_sub_indicators)) continue;

      for (const frameworkSub of fullSubs) {
        for (const aiSub of assessment.fulfilled_sub_indicators) {
          if (isLikelySameSubIndicator(aiSub, frameworkSub)) {
            bucket.add(normalise(frameworkSub));
            break;
          }
        }
      }
    }
  }

  // 2. Count against the full local framework
  const count = (
    data: { themes: { indicators: { sub_indicators: string[] }[] }[] },
    bucket: Set<string>
  ) => {
    let total = 0;
    let fulfilled = 0;
    for (const theme of data.themes) {
      for (const ind of theme.indicators) {
        for (const sub of ind.sub_indicators) {
          total++;
          if (bucket.has(normalise(sub))) fulfilled++;
        }
      }
    }
    return { total, fulfilled, percentage: total > 0 ? Math.round((fulfilled / total) * 10000) / 100 : 0 };
  };

  return {
    karakter: count(karakterData, fulfilledByCategory["Karakter"]),
    mental: count(mentalData, fulfilledByCategory["Mental"]),
    soft_skill: count(softSkillData, fulfilledByCategory["Soft Skill"]),
  };
}

// ─── RAG formatting helpers ─────────────────────────────────────────────────

export interface CriteriaRow {
  category: string;
  theme: string;
  indicator: string;
  sub_indicator: string;
  similarity: number;
}

export interface KnowledgeRow {
  id: number;
  content: string;
  section: string;
  page_start: number;
  similarity: number;
}

// If the query looks like a direct knowledge question ("Apa itu X?", "Jelaskan Y"),
// expand it with CMS domain context so the embedding lands closer to the right
// PDF chunks (which are dense 300-word passages, not short questions).
export function expandKnowledgeQuery(query: string): string {
  // Strip speaker prefixes like "Guru: " or "AI: " that appear in transcript lines
  const stripped = query.replace(/^(Guru|AI|Ustadz|Murid)\s*:\s*/im, "").trim();
  const isQuestion = /^(apa|jelaskan|bagaimana|siapa|mengapa|kenapa|ceritakan|tolong|bisa|boleh)/i.test(stripped);
  if (isQuestion) {
    // Return expanded query WITHOUT the "Guru:" prefix so the embedding
    // focuses on the actual question content, not the speaker label
    return `${stripped} penjelasan dalam konteks Quran Character Building Mental Building Soft Skill CMS Quranik pesantren Islam`;
  }
  return stripped || query;
}

export function formatKnowledgeContext(rows: KnowledgeRow[]): string {
  if (rows.length === 0) return "";

  return rows
    .map((row) => {
      // Strip the "[Section Name]" prefix that was prepended during ingest
      // so the AI sees clean prose, not the metadata tag
      const cleanContent = row.content.replace(/^\[[^\]]+\]\n/, "").trim();
      return `— ${row.section}:\n${cleanContent}`;
    })
    .join("\n\n");
}

// ─── Format retrieved rows into a compact, structured string ──────────────────

export function formatCriteriaContext(rows: CriteriaRow[]): string {
  // Group: category -> theme -> indicator -> [sub_indicators]
  const grouped: Record<string, Record<string, Record<string, string[]>>> = {};

  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = {};
    if (!grouped[row.category][row.theme]) grouped[row.category][row.theme] = {};
    if (!grouped[row.category][row.theme][row.indicator]) {
      grouped[row.category][row.theme][row.indicator] = [];
    }
    grouped[row.category][row.theme][row.indicator].push(row.sub_indicator);
  }

  const lines: string[] = [];
  for (const [cat, themes] of Object.entries(grouped)) {
    lines.push(`## Kategori: ${cat}`);
    for (const [theme, indicators] of Object.entries(themes)) {
      lines.push(`  ### Tema: ${theme}`);
      for (const [indicator, subs] of Object.entries(indicators)) {
        lines.push(`    Indikator: ${indicator}`);
        for (const sub of subs) {
          lines.push(`      - ${sub}`);
        }
      }
    }
  }

  return lines.join("\n");
}

export function getRecentTranscriptWindow(transcript: string, maxLines = 4): string {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-maxLines).join("\n");
}

export function buildUnexploredThemesContext(frontierRows: CriteriaRow[], discoveredThemes: string[], limit = 4): string {
  const frontierThemes = new Set(frontierRows.map((row) => normalise(row.theme)));
  const discovered = new Set(discoveredThemes.map((t) => normalise(t)));

  const allThemes = [
    ...karakterData.themes.map((theme) => ({ category: "Karakter", title: theme.title })),
    ...mentalData.themes.map((theme) => ({ category: "Mental", title: theme.title })),
    ...softSkillData.themes.map((theme) => ({ category: "Soft Skill", title: theme.title })),
  ];

  const unexplored = allThemes
    .filter((theme) => !discovered.has(normalise(theme.title)))
    .filter((theme) => !frontierThemes.has(normalise(theme.title)))
    .slice(0, limit);

  if (unexplored.length === 0) return "";

  return unexplored.map((theme) => `- ${theme.category}: ${theme.title}`).join("\n");
}
