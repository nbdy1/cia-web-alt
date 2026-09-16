/**
 * Canonicalizes Soft Skill assessments against soft-skill.ts.
 * The old Soft Skill 4 structure was replaced by a different five-indicator
 * structure, so its prior evidence is retained outside scored assessments.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { softSkillData } from "../lib/data/soft-skill";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service-role credentials in .env.local");
const db = createClient(url, key);
const apply = process.argv.includes("--apply");

const normalise = (value: unknown) => String(value ?? "")
  .toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
const isSame = (left: unknown, right: unknown) => {
  const a = normalise(left); const b = normalise(right);
  return a === b || (a.length > 12 && b.length > 12 && (a.includes(b) || b.includes(a)));
};

const themeAliases: Record<string, string> = {
  "keinginan untuk selalu mengembangkan diri": "keinginan untuk selalu mengembangkan diri",
  "kesetiaan pada agama dalam wujud berbuat benar": "kesetiaan pada agama dalam wujud berbuat benar",
  "menyayangi manusia dalam wujud memaafkan memaklumi": "menyayangi manusia dalam wujud memaafkan dan memaklumi",
  "kesetiaan pada tujuan": "kesetiaan pada tujuan",
  "kemauan untuk berkurban demi tercapainya tujuan": "kemauan untuk berkurban demi tercapainya tujuan",
  "kekuatan untuk mengelola konflik": "kekuatan untuk mengelola konflik",
  "keberanian untuk mengambil keputusan dan menanggung resikonya": "keberanian untuk mengambil keputusan dan menanggung resikonya",
  "memahami apa yang ia buat atau rencanakan masterplan": "memahami apa yang ia buat atau rencanakan masterplan",
  "pandai membujuk orang persuasif": "pandai membujuk orang persuasif",
  "pandai memaksa orang imperatif": "pandai memaksa orang imperatif",
  "kemampuan komunikasi dalam wujud interaksi negoisasi": "kemampuan komunikasi dalam wujud interaksi negoisasi",
  "kepandaian memilih diksi yang mumpuni": "kepandaian memilih diksi yang mumpuni",
  "daya ajak yang kuat": "daya ajak yang kuat",
  "tauladan yang selaras dengan pikiran dan kata katanya": "tauladan yang selaras dengan pikiran dan kata katanya",
};
const indicatorAliases: Record<string, string> = {
  "tidak perhitungan": "tidak komersil dalam hal menolong",
  "empati dalam risiko": "ingin memperkecil risiko atau dampak buruk terhadap orang lain",
  "pandai dalam komunikasi": "pandai bicara",
  "transparansi kejujuran": "transparan",
  "kolaboratif": "pandai bekerjasama",
  "ketegasan dalam perintah": "tegas dalam memberikan perintah",
};

function migrateAssessment(assessment: any) {
  if (normalise(assessment?.category) !== "soft skill") return { assessment, legacy: null, changed: false };
  if (normalise(assessment.theme) === "kesetiaan pada tujuan") {
    return {
      assessment: null,
      legacy: { ...assessment, migrated_reason: "Struktur indikator Soft Skill terbaru berubah; pemenuhan tidak ditebak." },
      changed: true,
    };
  }
  const oldTheme = normalise(assessment.theme);
  const theme = softSkillData.themes.find((candidate) => isSame(candidate.title, assessment.theme) || normalise(candidate.title) === themeAliases[oldTheme]);
  if (!theme) return { assessment, legacy: null, changed: false };
  const oldIndicator = normalise(assessment.indicator);
  const indicator = theme.indicators.find((candidate) => isSame(candidate.title, assessment.indicator) || normalise(candidate.title) === indicatorAliases[oldIndicator]);
  if (!indicator) return { assessment, legacy: null, changed: false };
  const source = Array.isArray(assessment.fulfilled_sub_indicators) ? assessment.fulfilled_sub_indicators : [];
  const fulfilled = indicator.sub_indicators.filter((sub) => source.some((value: unknown) => isSame(value, sub)));
  const declinedSource = Array.isArray(assessment.declined_sub_indicators) ? assessment.declined_sub_indicators : [];
  const declined = indicator.sub_indicators.filter((sub) => declinedSource.some((value: unknown) => isSame(value, sub)) && !fulfilled.some((item) => normalise(item) === normalise(sub)));
  const migrated = {
    ...assessment, category: "Soft Skill", theme: theme.title, indicator: indicator.title,
    fulfilled_sub_indicators: fulfilled, declined_sub_indicators: declined,
    missing_sub_indicators: indicator.sub_indicators.filter((sub) => !fulfilled.some((item) => normalise(item) === normalise(sub))),
    fulfillment_fraction: `${fulfilled.length}/${indicator.sub_indicators.length}`,
  };
  return { assessment: migrated, legacy: null, changed: JSON.stringify(migrated) !== JSON.stringify(assessment) };
}

function migratePlan(plan: any) {
  if (!plan || !Array.isArray(plan.detailed_assessments)) return { plan, changed: false, legacyCount: 0 };
  const legacy = Array.isArray(plan.legacy_framework_evidence) ? [...plan.legacy_framework_evidence] : [];
  let changed = false;
  const assessments = plan.detailed_assessments.flatMap((assessment: any) => {
    const result = migrateAssessment(assessment); changed ||= result.changed;
    if (result.legacy) legacy.push(result.legacy);
    return result.assessment ? [result.assessment] : [];
  });
  return changed
    ? { plan: { ...plan, detailed_assessments: assessments, ...(legacy.length ? { legacy_framework_evidence: legacy } : {}) }, changed, legacyCount: legacy.length }
    : { plan, changed: false, legacyCount: 0 };
}

async function main() {
  let from = 0; let scanned = 0; let changed = 0; let legacy = 0;
  while (true) {
    const { data: reports, error } = await db.from("reports").select("id, treatment_plan")
      .not("treatment_plan", "is", null).order("id", { ascending: true }).range(from, from + 199);
    if (error) throw error;
    if (!reports?.length) break;
    const updates: { id: string; plan: unknown }[] = [];
    for (const report of reports) {
      scanned++;
      let plan = report.treatment_plan;
      if (typeof plan === "string") { try { plan = JSON.parse(plan); } catch { continue; } }
      const result = migratePlan(plan);
      if (!result.changed) continue;
      changed++; legacy += result.legacyCount;
      if (apply) updates.push({ id: report.id, plan: result.plan });
    }
    for (let index = 0; index < updates.length; index += 20) {
      const results = await Promise.all(updates.slice(index, index + 20).map(({ id, plan }) => db.from("reports").update({ treatment_plan: plan }).eq("id", id)));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }
    from += reports.length;
    if (reports.length < 200) break;
  }
  console.log(`${apply ? "Migrated" : "Would migrate"} ${changed}/${scanned} report(s); ${legacy} assessment(s) preserved as legacy evidence.`);
}

main().catch((error) => { console.error("Soft Skill report migration failed:", error.message); process.exitCode = 1; });
