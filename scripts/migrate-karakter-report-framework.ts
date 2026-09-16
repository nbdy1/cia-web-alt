/**
 * Migrates report JSON to the latest Karakter framework without inventing
 * fulfilled criteria. Default mode is read-only.
 *
 * Policy:
 * - An old assessment is rewritten only when its theme + indicator still have
 *   one unambiguous canonical equivalent.
 * - Assessments whose old indicator was split into a new structure are moved
 *   to legacy_framework_evidence. They remain readable, but never count as
 *   fulfillment of a newly introduced sub-indicator.
 *
 * Usage:
 *   npx tsx scripts/migrate-karakter-report-framework.ts --dry-run
 *   npx tsx scripts/migrate-karakter-report-framework.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { karakterData } from "../lib/data/karakter";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service-role credentials in .env.local");

const db = createClient(url, key);
const apply = process.argv.includes("--apply");

const normalise = (value: unknown) => String(value ?? "")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const isSame = (left: unknown, right: unknown) => {
  const a = normalise(left);
  const b = normalise(right);
  return a === b || (a.length > 12 && b.length > 12 && (a.includes(b) || b.includes(a)));
};

const splitLegacyIndicators = new Set([
  "santri yang bisa memimpin",
  "santri yang bisa dipimpin",
  "konsistensi ibadah keterikatan al quran",
  "rasa ingin tahu besar",
  "gemar membaca",
  "berpikiran terbuka",
  "suka mencoba hal baru",
]);

// Wording-only changes in the September 2026 Karakter PDF. These retain the
// same meaning and sub-indicator structure, so carrying fulfillment forward is
// safe under the migration policy.
const legacyIndicatorAliases: Record<string, string> = {
  "kesungguhan dalam usaha": "kesungguhan dalam ikhtiar",
  "kesadaran diri yang tinggi": "kesadaran diri yang tinggi",
  "kuat pengendalian dirinya": "kuat pengendalian dirinya",
  "komit pada nilai kebenaran": "komit pada nilai kebenaran",
  "belajar dari kesalahan": "belajar dari kesalahan",
  "memilih teman dan lingkungan": "memilih teman dan lingkungan",
  "kesadaran akan hakikat hidup": "menyadari hakikat hidup",
  "tidak mudah tergoda jalan pintas": "tidak tergoda jalan pintas",
  "kesadaran bahwa tangis ujian": "kesadaran bahwa tangis adalah ujian",
  "kendali diri dalam kebahagiaan": "mampu mengendalikan diri ketika bahagia",
  "menjaga dari maksiat": "menjauhi maksiat",
  "kesadaran akan sementara nya dunia": "sadar bahwa dunia ini hanyalah sementara",
  "menguatkan iman dalam nikmat": "tetap menguatkan iman walau dalam keadaan bahagia",
  "konsistensi dalam usaha": "konsistensi dalam ikhtiar",
  "menemukan hikmah sejak awal": "dapat menemukan hikmah sejak awal",
  "motivasi intrinsik": "motivasinya muncul dari internal diri sendiri",
  "kesadaran tanggung jawab": "kesadaran akan adanya tanggung jawab",
  "landasan syariat": "berpikir dengan berlandaskan syariat",
  "kesadaran risiko": "kesadaran akan pasti adanya risiko",
  "kesadaran bahwa konflik ujian": "kesadaran bahwa konflik adalah salah satu dari bentuk ujian",
};

const legacyThemeAliases: Record<string, string> = {
  "menerima kesalahan dengan wajar tidak menyalahkan siapapun tanpa argumentasi yang logis dan syari": "menerima kesalahan dengan wajar tidak menyalahkan apapun dan siapapun tanpa argumentasi yang logis dan syari",
};

function canonicalIndicator(themeTitle: unknown, indicatorTitle: unknown) {
  const oldTheme = normalise(themeTitle);
  const themeAlias = legacyThemeAliases[oldTheme];
  const theme = karakterData.themes.find((candidate) =>
    isSame(candidate.title, themeTitle) || (themeAlias ? normalise(candidate.title) === themeAlias : false),
  );
  if (!theme) return null;
  const oldTitle = normalise(indicatorTitle);
  const alias = legacyIndicatorAliases[oldTitle];
  const indicator = theme.indicators.find((candidate) =>
    isSame(candidate.title, indicatorTitle) || (alias ? normalise(candidate.title) === alias : false),
  );
  return indicator ? { theme: theme.title, indicator } : null;
}

function canonicalSubs(values: unknown, candidates: string[]) {
  const source = Array.isArray(values) ? values : [];
  return candidates.filter((candidate) => source.some((value) => isSame(value, candidate)));
}

function migrateAssessment(assessment: any) {
  if (normalise(assessment?.category) !== "karakter") return { assessment, legacy: null, changed: false };

  if (splitLegacyIndicators.has(normalise(assessment?.indicator))) {
    return {
      assessment: null,
      legacy: { ...assessment, migrated_reason: "Indikator lama telah dipecah menjadi indikator baru; pemenuhan tidak ditebak." },
      changed: true,
    };
  }

  const canonical = canonicalIndicator(assessment?.theme, assessment?.indicator);
  if (!canonical) return { assessment, legacy: null, changed: false };

  const fulfilled = canonicalSubs(assessment?.fulfilled_sub_indicators, canonical.indicator.sub_indicators);
  const declined = canonicalSubs(assessment?.declined_sub_indicators, canonical.indicator.sub_indicators)
    .filter((sub) => !fulfilled.some((fulfilledSub) => normalise(fulfilledSub) === normalise(sub)));
  const missing = canonical.indicator.sub_indicators.filter(
    (sub) => !fulfilled.some((fulfilledSub) => normalise(fulfilledSub) === normalise(sub)),
  );

  const migrated = {
    ...assessment,
    category: "Karakter",
    theme: canonical.theme,
    indicator: canonical.indicator.title,
    fulfilled_sub_indicators: fulfilled,
    declined_sub_indicators: declined,
    missing_sub_indicators: missing,
    fulfillment_fraction: `${fulfilled.length}/${canonical.indicator.sub_indicators.length}`,
  };
  return { assessment: migrated, legacy: null, changed: JSON.stringify(migrated) !== JSON.stringify(assessment) };
}

function migratePlan(plan: any) {
  if (!plan || !Array.isArray(plan.detailed_assessments)) return { plan, changed: false, legacyCount: 0 };

  const legacy: any[] = Array.isArray(plan.legacy_framework_evidence) ? [...plan.legacy_framework_evidence] : [];
  let changed = false;
  const assessments = plan.detailed_assessments.flatMap((assessment: any) => {
    const result = migrateAssessment(assessment);
    changed ||= result.changed;
    if (result.legacy) legacy.push(result.legacy);
    return result.assessment ? [result.assessment] : [];
  });

  if (!changed) return { plan, changed: false, legacyCount: 0 };
  return {
    plan: {
      ...plan,
      detailed_assessments: assessments,
      ...(legacy.length > 0 ? { legacy_framework_evidence: legacy } : {}),
    },
    changed: true,
    legacyCount: legacy.length,
  };
}

async function main() {
  let from = 0;
  let scanned = 0;
  let changed = 0;
  let legacy = 0;

  while (true) {
    const { data: reports, error } = await db
      .from("reports")
      .select("id, treatment_plan")
      .not("treatment_plan", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 199);
    if (error) throw error;
    if (!reports?.length) break;

    for (const report of reports) {
      scanned++;
      let plan = report.treatment_plan;
      if (typeof plan === "string") {
        try { plan = JSON.parse(plan); } catch { continue; }
      }
      const result = migratePlan(plan);
      if (!result.changed) continue;
      changed++;
      legacy += result.legacyCount;
      if (apply) {
        const { error: updateError } = await db
          .from("reports")
          .update({ treatment_plan: result.plan })
          .eq("id", report.id);
        if (updateError) throw updateError;
      }
    }

    from += reports.length;
    if (reports.length < 200) break;
  }

  console.log(`${apply ? "Migrated" : "Would migrate"} ${changed}/${scanned} report(s); ${legacy} assessment(s) preserved as legacy evidence.`);
}

main().catch((error) => {
  console.error("Karakter report migration failed:", error.message);
  process.exitCode = 1;
});
