/**
 * Canonicalizes Mental assessments in report JSON against mental.ts.
 * Old evidence is retained, but fulfillment is only carried forward for an
 * unambiguous current sub-indicator.
 *
 * Usage:
 *   npx tsx scripts/migrate-mental-report-framework.ts --dry-run
 *   npx tsx scripts/migrate-mental-report-framework.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { mentalData } from "../lib/data/mental";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service-role credentials in .env.local");

const db = createClient(url, key);
const apply = process.argv.includes("--apply");

const normalise = (value: unknown) => String(value ?? "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const isSame = (left: unknown, right: unknown) => {
  const a = normalise(left);
  const b = normalise(right);
  return a === b || (a.length > 12 && b.length > 12 && (a.includes(b) || b.includes(a)));
};

const themeAliases: Record<string, string> = {
  "mental inisiatif": "inisiatif",
  "mental belajar": "belajar",
  "mental antisipatif daya tangkal": "antisipatif daya tangkal",
  "mental itmi": "mental itm",
  "tidak ada rasa malu kecuali dosa": "tidak ada rasa malu kecuali di tiga keadaan",
  "daya juang": "daya juang",
};

const indicatorAliases: Record<string, string> = {
  "berusaha mengamalkan banyak sunah nabi saw": "mengamalkan sunah utama nabi saw",
  "bisnis yang beretika syariah": "bisnis yang beretika syari",
  "sadar bahwa hidup ujian": "sadar bahwa hidup adalah ujian",
  "mental kompetitif yang sehat": "kompetitif yang sehat",
  "dia punya tanggung jawab yang besar": "punya tanggung jawab yang besar",
  "dia kreatif dalam mencari solusi": "kreatif dalam mencari solusi",
  "ia peka secara sosial": "peka secara sosial",
  "bisa mempertahankan perubahan": "bisa mempertahankan perubahan itu",
  "memiliki tanggung jawab spiritual ang kuat": "memiliki tanggung jawab spiritual yang kuat",
};

function canonicalAssessment(assessment: any) {
  if (normalise(assessment?.category) !== "mental") return null;
  const oldTheme = normalise(assessment.theme);
  const themeAlias = themeAliases[oldTheme];
  const theme = mentalData.themes.find((candidate) =>
    isSame(candidate.title, assessment.theme) || normalise(candidate.title) === themeAlias,
  );
  if (!theme) return null;

  const oldIndicator = normalise(assessment.indicator);
  const indicatorAlias = indicatorAliases[oldIndicator];
  const indicator = theme.indicators.find((candidate) =>
    isSame(candidate.title, assessment.indicator) || normalise(candidate.title) === indicatorAlias,
  );
  return indicator ? { theme, indicator } : null;
}

function canonicalSubs(values: unknown, candidates: string[]) {
  const source = Array.isArray(values) ? values : [];
  return candidates.filter((candidate) => source.some((value) => isSame(value, candidate)));
}

function migratePlan(plan: any) {
  if (!plan || !Array.isArray(plan.detailed_assessments)) return { plan, changed: false };
  let changed = false;
  const assessments = plan.detailed_assessments.map((assessment: any) => {
    const canonical = canonicalAssessment(assessment);
    if (!canonical) return assessment;

    const fulfilled = canonicalSubs(assessment.fulfilled_sub_indicators, canonical.indicator.sub_indicators);
    const declined = canonicalSubs(assessment.declined_sub_indicators, canonical.indicator.sub_indicators)
      .filter((sub) => !fulfilled.some((item) => normalise(item) === normalise(sub)));
    const migrated = {
      ...assessment,
      category: "Mental",
      theme: canonical.theme.title,
      indicator: canonical.indicator.title,
      fulfilled_sub_indicators: fulfilled,
      declined_sub_indicators: declined,
      missing_sub_indicators: canonical.indicator.sub_indicators.filter(
        (sub) => !fulfilled.some((item) => normalise(item) === normalise(sub)),
      ),
      fulfillment_fraction: `${fulfilled.length}/${canonical.indicator.sub_indicators.length}`,
    };
    changed ||= JSON.stringify(migrated) !== JSON.stringify(assessment);
    return migrated;
  });
  return { plan: changed ? { ...plan, detailed_assessments: assessments } : plan, changed };
}

async function main() {
  let from = 0;
  let scanned = 0;
  let changed = 0;
  while (true) {
    const { data: reports, error } = await db.from("reports")
      .select("id, treatment_plan").not("treatment_plan", "is", null)
      .order("id", { ascending: true }).range(from, from + 199);
    if (error) throw error;
    if (!reports?.length) break;
    const pendingUpdates: { id: string; plan: unknown }[] = [];
    for (const report of reports) {
      scanned++;
      let plan = report.treatment_plan;
      if (typeof plan === "string") {
        try { plan = JSON.parse(plan); } catch { continue; }
      }
      const result = migratePlan(plan);
      if (!result.changed) continue;
      changed++;
      if (apply) pendingUpdates.push({ id: report.id, plan: result.plan });
    }
    for (let index = 0; index < pendingUpdates.length; index += 20) {
      const batch = pendingUpdates.slice(index, index + 20);
      const results = await Promise.all(batch.map(({ id, plan }) =>
        db.from("reports").update({ treatment_plan: plan }).eq("id", id),
      ));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }
    from += reports.length;
    if (reports.length < 200) break;
  }
  console.log(`${apply ? "Migrated" : "Would migrate"} ${changed}/${scanned} report(s).`);
}

main().catch((error) => {
  console.error("Mental report migration failed:", error.message);
  process.exitCode = 1;
});
