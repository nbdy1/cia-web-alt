/**
 * scripts/seed-insan-pratama-demo.ts
 *
 * Creates the "Pondok Pesantren Insan Pratama" organization and three DEMO
 * accounts (admin, ustadz, orang tua) with a few fictional santri, so the
 * parent dashboard can be shown to the school.
 *
 * Everything is fictional demo data: santri names, interviews, reports and parent
 * updates are invented (see demo/insan-pratama-stories.ts) and written directly
 * (no AI calls, no cost). Re-running replaces the demo reports, never real ones. Accounts are
 * pre-confirmed through the Admin API, so no email verification is needed.
 *
 * Requires the 20261124_parent_dashboard.sql migration for the parent part; the
 * organization, admin and ustadz are created either way, so re-run this script
 * after applying the migration. Idempotent: safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/seed-insan-pratama-demo.ts
 *
 * Demo credentials (throwaway; change or delete the accounts after the demo):
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { computeOverallStats } from "../lib/ai/assessment-helpers";
import { FRAMEWORKS, PARENT_PROFILES, STORIES, transcript, type Pick, type Story } from "./demo/insan-pratama-stories";
import { PARENT_CONSENT_VERSION, computeTrends } from "../lib/parent";
import { monthBounds, monthKeyFromIso } from "../lib/bk-monthly";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const DEMO_PASSWORD = "InsanDemo2026";
const ACCOUNTS = {
  admin: { name: "Admin Demo Insan Pratama", email: "admin.demo@ciatest.id", role: "admin" },
  ustadz: { name: "Ustadz Demo Insan Pratama", email: "ustadz.demo@ciatest.id", role: "ustadz" },
  parent: { name: "Bapak Demo (Orang Tua)", email: "ortu.demo@ciatest.id", role: "parent" },
} as const;

const ORG = { name: "Pondok Pesantren Insan Pratama", slug: "insanpratama", primary_color: "#0f766e" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function getOrCreateUser(email: string, name: string, role: string) {
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name, role } });
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name, role },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
}

async function setMembership(orgId: string, userId: string, name: string, email: string, role: string) {
  const { error: pErr } = await db.from("profiles").upsert({ id: userId, name, email, role, organization_id: orgId }, { onConflict: "id" });
  if (pErr) throw pErr;
  // Demo accounts must belong ONLY to the demo school (a DB trigger may have
  // auto-enrolled them in the default one).
  await db.from("organization_members").delete().eq("user_id", userId).neq("organization_id", orgId);
  const { error } = await db.from("organization_members").upsert(
    { organization_id: orgId, user_id: userId, role }, { onConflict: "organization_id,user_id" },
  );
  if (error) throw error;
}

// ── Demo content ────────────────────────────────────────────────────────────

const SANTRI = [
  { name: "Muhammad Fadhil Ramadhan", nis: "IP001" },
  { name: "Aisyah Khairunnisa", nis: "IP002" },
  { name: "Zidan Al-Fatih", nis: "IP003" },
  { name: "Nabila Zahrotul Jannah", nis: "IP004" },
  { name: "Raihan Abdurrahman", nis: "IP005" },
  { name: "Siti Maryam Azzahra", nis: "IP006" },
];

const themeTitle = (pick: { fw: keyof typeof FRAMEWORKS; theme: number }) => FRAMEWORKS[pick.fw].themes[pick.theme].title;

/** One detailed assessment in the same shape the AI pipeline stores. */
function assessment(pick: Pick) {
  const data = FRAMEWORKS[pick.fw];
  const theme = data.themes[pick.theme];
  const indicator = theme?.indicators[pick.indicator];
  if (!indicator) throw new Error(`Unknown CMS indicator ${pick.fw}/${pick.theme}/${pick.indicator}`);
  const subs = indicator.sub_indicators as string[];
  const fulfilled = pick.fulfilled.filter((i) => i < subs.length);
  if (fulfilled.length === 0) throw new Error(`No fulfilled sub-indicator for ${pick.fw}/${pick.theme}/${pick.indicator}`);
  return {
    category: data.category,
    theme: theme.title,
    indicator: indicator.title,
    reasoning: pick.reasoning,
    fulfilled_sub_indicators: fulfilled.map((i) => subs[i]),
    declined_sub_indicators: [],
    missing_sub_indicators: subs.filter((_, i) => !fulfilled.includes(i)),
  };
}

function buildPlan(story: Story, orgId: string) {
  const assessments = story.picks.map(assessment);
  const prio = FRAMEWORKS[story.priority.fw].themes[story.priority.theme];
  const prioIndicator = prio.indicators[story.priority.indicator];
  return {
    report_title: story.title,
    status_summary: story.status_summary,
    analysis_version: 1,
    output_language: "id",
    model_used: MODEL_LABEL,
    demo_seed: true, // marks fictional demo reports so re-running can replace them
    // Same function the real pipeline uses, so the numbers match what teachers see.
    overall_stats: computeOverallStats({ detailed_assessments: assessments }, orgId),
    detailed_assessments: assessments,
    treatment: {
      priority_theme: prio.title,
      priority_indicator: prioIndicator.title,
      target_sub_indicators: (prioIndicator.sub_indicators as string[]).slice(0, 2),
      action_plan: story.action_plan,
    },
    diagnostic_guidance_considered: [],
  };
}

const MODEL_LABEL = "google/gemini-3-flash-preview";

async function seedStudent(orgId: string, nis: string, studentId: string, ustadzId: string) {
  const stories = STORIES.filter((s) => s.nis === nis).sort((a, b) => b.daysAgo - a.daysAgo);
  if (stories.length === 0) return;

  const { data: existing } = await db.from("reports").select("id, model_used, treatment_plan").eq("student_id", studentId);
  const isDemo = (r: { model_used: string | null; treatment_plan: any }) => r.model_used === "demo-seed" || r.treatment_plan?.demo_seed === true;
  if ((existing ?? []).some((r) => !isDemo(r))) {
    console.log(`  ${nis}: has real reports, left untouched`);
    return;
  }
  if ((existing ?? []).length > 0) {
    await db.from("parent_contents").delete().eq("student_id", studentId);
    await db.from("reports").delete().in("id", (existing ?? []).map((r) => r.id));
  }

  const now = new Date().toISOString();
  const put = async (row: Record<string, unknown>, published: boolean) => {
    const { error } = await db.from("parent_contents").insert({
      organization_id: orgId, student_id: studentId, draft: row.content, model_used: MODEL_LABEL,
      status: published ? "published" : "pending",
      reviewer_id: published ? ustadzId : null, reviewed_at: published ? now : null, published_at: published ? now : null,
      ...row,
    });
    if (error) throw error;
  };

  const stored: { created_at: string; treatment_plan: unknown }[] = [];
  for (const [index, story] of stories.entries()) {
    const isLatest = index === stories.length - 1;
    const createdAt = new Date(Date.now() - story.daysAgo * 86_400_000).toISOString();
    const plan = buildPlan(story, orgId);
    stored.push({ created_at: createdAt, treatment_plan: plan });

    const { data: report, error } = await db
      .from("reports")
      .insert({
        student_id: studentId, organization_id: orgId, title: story.title, narrative: transcript(story.talk),
        treatment_plan: plan, model_used: MODEL_LABEL, created_by: ustadzId, created_at: createdAt,
      })
      .select("id")
      .single();
    if (error || !report) throw error ?? new Error("report insert failed");

    // The newest report's cards wait in the musyrif's queue (shows the approval flow);
    // older ones are already approved and visible to the parent.
    const sensitive = !!story.parent.sensitive;
    await put({
      content_type: "update", kind: "kabar_baik", aspect: "karakter", report_id: report.id, created_at: createdAt,
      content: {
        text: story.parent.good, actions: story.parent.tips.slice(0, 1), focus: null, duration: null,
        observed: story.picks.slice(0, 3).map((p) => ({ theme: themeTitle(p), text: p.phrase })),
      },
    }, !isLatest);
    await put({
      content_type: "update", kind: "didampingi", aspect: "soft_skill", report_id: report.id, created_at: createdAt,
      sensitive, sensitive_reason: sensitive ? story.parent.sensitive : null,
      content: { text: story.parent.focusText, actions: story.parent.tips.slice(-1), focus: story.parent.focus, duration: "2 minggu", observed: [] },
    }, !isLatest);
  }

  // Monthly summaries (trend labels computed in code) + character profile.
  const pr = PARENT_PROFILES[nis];
  const months = Array.from(new Set(stored.map((x) => monthKeyFromIso(x.created_at)!)));
  for (const [i, month] of months.entries()) {
    const latestMonth = i === months.length - 1;
    await put({
      content_type: "summary", period_key: month,
      content: { overview: pr.overview, strengths: pr.strengths, growth_areas: pr.growth_areas, next_focus: pr.next_focus, trends: computeTrends(stored, monthBounds(month)) },
    }, !latestMonth || months.length === 1);
  }
  await put({ content_type: "profile", content: pr.profile }, true);
  console.log(`  ${nis}: ${stories.length} reports with interview + CMS assessments, parent cards, ${months.length} summary, profile`);
}

const SEMESTER = "Semester 1 2026/2027";
const SCORE_TYPES = [
  { type: "Hafalan", col: "nilai_harian" }, { type: "Muhadharah", col: "nilai_harian" },
  { type: "FR", col: "nilai_bulanan" }, { type: "AR", col: "nilai_bulanan" }, { type: "3PFB", col: "nilai_akhir" },
] as const;

/** QCB / QMB / QSB scores (fictional) so the "Nilai CMS" section has data. */
async function seedScores(orgId: string, studentId: string, base: number) {
  const rows = ["QCB", "QMB", "QSB"].flatMap((subject, si) =>
    SCORE_TYPES.map((t, ti) => ({
      student_id: studentId, organization_id: orgId, period: SEMESTER, subject, score_type: t.type,
      nilai_harian: null, nilai_bulanan: null, nilai_akhir: null,
      [t.col]: Math.min(98, base + ((si * 5 + ti * 3) % 11)),
    })),
  );
  const { error } = await db.from("student_scores").upsert(rows, { onConflict: "student_id,period,subject,score_type" });
  if (error) throw error;
}

async function main() {
  // 1. Organization
  const { data: found } = await db.from("organizations").select("id").eq("slug", ORG.slug).maybeSingle();
  let orgId = found?.id as string | undefined;
  if (!orgId) {
    const { data, error } = await db.from("organizations").insert(ORG).select("id").single();
    if (error || !data) throw error ?? new Error("organization insert failed");
    orgId = data.id;
    console.log(`Created organization ${ORG.name} (${orgId})`);
  } else {
    await db.from("organizations").update({ name: ORG.name, primary_color: ORG.primary_color }).eq("id", orgId);
    console.log(`Organization exists (${orgId})`);
  }

  // 2. Admin + ustadz
  const adminId = await getOrCreateUser(ACCOUNTS.admin.email, ACCOUNTS.admin.name, "admin");
  await setMembership(orgId, adminId, ACCOUNTS.admin.name, ACCOUNTS.admin.email, "admin");
  const ustadzId = await getOrCreateUser(ACCOUNTS.ustadz.email, ACCOUNTS.ustadz.name, "ustadz");
  await setMembership(orgId, ustadzId, ACCOUNTS.ustadz.name, ACCOUNTS.ustadz.email, "ustadz");
  console.log("Admin + ustadz accounts ready");

  // 3. Santri
  const ids: Record<string, string> = {};
  for (const s of SANTRI) {
    const { data: ex } = await db.from("students").select("id").eq("organization_id", orgId).eq("nis", s.nis).maybeSingle();
    if (ex) { ids[s.nis] = ex.id; continue; }
    const { data, error } = await db.from("students").insert({ ...s, organization_id: orgId, assigned_ustadz_id: ustadzId }).select("id").single();
    if (error || !data) throw error ?? new Error(`student ${s.name} failed`);
    ids[s.nis] = data.id;
  }
  console.log(`${SANTRI.length} demo santri ready`);

  // 4. Parent part (needs the migration)
  const probe = await db.from("students").select("parent_code").limit(1);
  if (probe.error) {
    console.warn("\n⚠ Parent part SKIPPED: students.parent_code is missing.");
    console.warn("  Run scripts/migrations/20261124_parent_dashboard.sql in the Supabase SQL editor, then re-run this script.");
    return;
  }

  const parentId = await getOrCreateUser(ACCOUNTS.parent.email, ACCOUNTS.parent.name, "parent");
  await setMembership(orgId, parentId, ACCOUNTS.parent.name, ACCOUNTS.parent.email, "parent");
  const { error: linkErr } = await db.from("parent_student_links").upsert(
    [ids["IP001"], ids["IP002"]].map((student_id) => ({ organization_id: orgId, parent_id: parentId, student_id })),
    { onConflict: "parent_id,student_id", ignoreDuplicates: true },
  );
  if (linkErr) throw linkErr;
  // Demo parent has already accepted the data-use consent so the dashboard opens directly.
  await db.from("parent_consents").upsert({ parent_id: parentId, version: PARENT_CONSENT_VERSION }, { onConflict: "parent_id,version" });
  await db.from("profiles").update({ phone: "081200000000" }).eq("id", ustadzId);
  for (const nis of Object.keys(ids)) await db.from("students").update({ class_name: "7A" }).eq("id", ids[nis]);
  console.log("Parent account ready, linked to IP001 + IP002");

  for (const [i, s] of SANTRI.entries()) {
    await seedStudent(orgId, s.nis, ids[s.nis], ustadzId);
    await seedScores(orgId, ids[s.nis], 74 + i * 2);
  }
  console.log(`QCB/QMB/QSB scores added for ${SEMESTER}`);

  const { data: codes } = await db.from("students").select("name, nis, parent_code").eq("organization_id", orgId).order("nis");
  console.log("\nPairing codes (IP003-IP006 are unlinked, use them to demo parent sign-up):");
  (codes ?? []).forEach((c: any) => console.log(`  ${c.nis}  ${c.parent_code}  ${c.name}`));

  console.log("\nDemo logins (password is DEMO_PASSWORD at the top of this file):");
  Object.values(ACCOUNTS).forEach((a) => console.log(`  ${a.role.padEnd(7)} ${a.email}`));
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
