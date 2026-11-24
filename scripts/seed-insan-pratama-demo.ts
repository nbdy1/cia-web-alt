/**
 * scripts/seed-insan-pratama-demo.ts
 *
 * Creates the "Pondok Pesantren Insan Pratama" organization and three DEMO
 * accounts (admin, ustadz, orang tua) with a few fictional santri, so the
 * parent dashboard can be shown to the school.
 *
 * Everything is fictional demo data: santri names, reports and parent updates are
 * invented and are written directly (no AI calls, no cost). Accounts are
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
import { karakterData } from "../lib/data/karakter";
import { mentalData } from "../lib/data/mental";
import { softSkillData } from "../lib/data/soft-skill";
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

type Pick = { data: typeof karakterData | typeof mentalData | typeof softSkillData; theme: number; indicator: number; fulfilled: number[] };

function assessment({ data, theme, indicator, fulfilled }: Pick) {
  const t = data.themes[theme];
  const ind = t.indicators[indicator];
  const subs = ind.sub_indicators as string[];
  return {
    category: data.category,
    theme: t.title,
    indicator: ind.title,
    fulfilled_sub_indicators: fulfilled.map((i) => subs[i]).filter(Boolean),
    declined_sub_indicators: [],
    missing_sub_indicators: subs.filter((_, i) => !fulfilled.includes(i)),
  };
}

type DemoReport = {
  daysAgo: number;
  title: string;
  status_summary: string;
  stats: [number, number, number]; // karakter, mental, soft skill %
  picks: Pick[];
  priority: { theme: number; indicator: number };
  action_plan: string;
  update: { title: string; body: string; highlights: string[]; focus_area: string; home_tip: string };
};

const stat = (p: number) => ({ total: 100, fulfilled: p, percentage: p });

const FADHIL_REPORTS: DemoReport[] = [
  {
    daysAgo: 42, title: "Adaptasi awal dan kedisiplinan ibadah",
    status_summary: "Fadhil masih beradaptasi dengan ritme asrama, namun rajin mengikuti salat berjamaah dan menunjukkan sikap santun kepada ustadz.",
    stats: [18, 12, 10],
    picks: [{ data: karakterData, theme: 0, indicator: 0, fulfilled: [0] }, { data: karakterData, theme: 1, indicator: 0, fulfilled: [0] }],
    priority: { theme: 2, indicator: 0 },
    action_plan: "Dampingi Fadhil menyusun jadwal harian sederhana agar lebih teratur.",
    update: {
      title: "Awal yang baik di asrama",
      body: "Alhamdulillah, Fadhil mulai terbiasa dengan ritme kehidupan pondok. Ia rajin mengikuti salat berjamaah dan bersikap santun kepada para ustadz.\n\nWajar bila di minggu-minggu awal ia masih menyesuaikan diri dengan jadwal asrama. Kami mendampinginya langkah demi langkah.",
      highlights: ["Rajin mengikuti salat berjamaah", "Santun kepada ustadz dan teman sekamar"],
      focus_area: "Membiasakan diri dengan jadwal harian asrama.",
      home_tip: "Saat menelepon, tanyakan satu hal yang ia syukuri hari itu agar ia merasa didengar.",
    },
  },
  {
    daysAgo: 21, title: "Mulai mandiri dan bertanggung jawab",
    status_summary: "Fadhil mulai menjaga kerapian kamar dan menyelesaikan piket tanpa diingatkan. Ia masih mudah kehilangan fokus saat belajar malam.",
    stats: [28, 20, 18],
    picks: [{ data: karakterData, theme: 0, indicator: 1, fulfilled: [0, 1] }, { data: karakterData, theme: 1, indicator: 1, fulfilled: [0] }],
    priority: { theme: 3, indicator: 0 },
    action_plan: "Beri target belajar malam yang pendek (20 menit) lalu tambah bertahap.",
    update: {
      title: "Mulai mandiri dan bertanggung jawab",
      body: "Dalam tiga minggu terakhir, Fadhil menunjukkan kemajuan yang menggembirakan. Ia mulai merapikan tempat tidur dan menyelesaikan piket tanpa harus diingatkan.\n\nIa masih sering kesulitan menjaga fokus saat belajar malam, dan ini sedang kami bina dengan target waktu yang pendek namun konsisten.",
      highlights: ["Merapikan kamar dan menyelesaikan piket tanpa diingatkan", "Lebih terbuka bercerita kepada ustadz"],
      focus_area: "Menjaga fokus saat belajar malam.",
      home_tip: "Apresiasi kemandiriannya, misalnya dengan mengatakan bahwa Bapak/Ibu bangga ia sudah bisa mengurus dirinya.",
    },
  },
  {
    daysAgo: 4, title: "Fokus belajar membaik",
    status_summary: "Fadhil kini mampu belajar malam lebih lama dan mulai membantu teman yang kesulitan menghafal. Kepercayaan dirinya meningkat.",
    stats: [41, 33, 30],
    picks: [{ data: karakterData, theme: 0, indicator: 2, fulfilled: [0, 2] }, { data: softSkillData, theme: 0, indicator: 0, fulfilled: [0] }],
    priority: { theme: 4, indicator: 0 },
    action_plan: "Beri kesempatan memimpin kelompok hafalan kecil untuk melatih kepemimpinan.",
    update: {
      title: "Fokus belajar membaik, mulai membantu teman",
      body: "Kabar baik pekan ini: Fadhil sudah mampu menjaga fokus belajar malam hampir sepanjang sesi. Ia bahkan mulai membantu temannya yang kesulitan menghafal.\n\nKepercayaan dirinya tumbuh. Langkah berikutnya, kami akan memberinya kesempatan memimpin kelompok hafalan kecil.",
      highlights: ["Belajar malam lebih fokus dan lebih lama", "Membantu teman yang kesulitan menghafal", "Lebih percaya diri berbicara di depan kelompok"],
      focus_area: "Belajar memimpin kelompok kecil dengan sabar.",
      home_tip: "Minta ia bercerita tentang hafalan yang sedang dipelajari; mendengarkan membuatnya makin semangat.",
    },
  },
];

const AISYAH_REPORTS: DemoReport[] = [
  {
    daysAgo: 30, title: "Ceria dan mudah bergaul",
    status_summary: "Aisyah mudah bergaul dan aktif dalam kegiatan kelompok, tetapi masih sering tergesa-gesa menyelesaikan tugas.",
    stats: [35, 30, 40],
    picks: [{ data: softSkillData, theme: 0, indicator: 0, fulfilled: [0, 1] }, { data: karakterData, theme: 1, indicator: 0, fulfilled: [0] }],
    priority: { theme: 2, indicator: 0 },
    action_plan: "Ajak Aisyah memeriksa ulang pekerjaannya sebelum dikumpulkan.",
    update: {
      title: "Ceria dan mudah bergaul",
      body: "Aisyah adalah santri yang ceria dan mudah akrab dengan teman-temannya. Ia aktif dalam kegiatan kelompok dan sering menjadi penyemangat.\n\nYang sedang kami bina adalah ketelitian: ia kerap tergesa-gesa saat mengerjakan tugas.",
      highlights: ["Aktif dan menyemangati teman dalam kegiatan kelompok", "Mudah beradaptasi dengan lingkungan baru"],
      focus_area: "Lebih teliti dan tidak tergesa-gesa dalam mengerjakan tugas.",
      home_tip: "Biasakan bertanya, \"Sudah kamu periksa lagi?\" dengan nada ringan sebelum ia menyelesaikan sesuatu.",
    },
  },
  {
    daysAgo: 6, title: "Lebih teliti dan sabar",
    status_summary: "Aisyah mulai memeriksa ulang tugasnya dan lebih sabar menunggu giliran. Ia juga menenangkan teman yang sedang sedih.",
    stats: [46, 41, 52],
    picks: [{ data: karakterData, theme: 1, indicator: 1, fulfilled: [0, 1] }, { data: softSkillData, theme: 1, indicator: 0, fulfilled: [0] }],
    priority: { theme: 5, indicator: 0 },
    action_plan: "Beri peran penanggung jawab kecil agar ketelitiannya terus terlatih.",
    update: {
      title: "Lebih teliti dan lebih sabar",
      body: "Alhamdulillah, Aisyah menunjukkan perubahan yang nyata. Ia kini memeriksa kembali tugasnya sebelum dikumpulkan dan lebih sabar menunggu giliran.\n\nKami juga melihat kepeduliannya tumbuh: ia menenangkan temannya yang sedang sedih tanpa diminta.",
      highlights: ["Memeriksa ulang tugas sebelum dikumpulkan", "Peduli dan menenangkan teman yang sedih"],
      focus_area: "Mempertahankan ketelitian saat suasana ramai.",
      home_tip: "Ceritakan pengalaman Bapak/Ibu bersikap sabar; teladan di rumah sangat membekas baginya.",
    },
  },
];

function summaryFor(who: "fadhil" | "aisyah") {
  return who === "fadhil"
    ? {
        overview: "Dalam sekitar enam pekan, Fadhil berkembang dari santri yang masih beradaptasi menjadi santri yang lebih mandiri dan percaya diri. Ibadah berjamaahnya terjaga, ia mulai bertanggung jawab atas kamar dan piketnya, dan belakangan fokus belajarnya membaik sehingga ia mampu membantu teman.",
        strengths: ["Rajin beribadah berjamaah", "Santun kepada ustadz", "Mulai mandiri", "Peduli pada teman"],
        growth_areas: ["Konsistensi fokus belajar", "Belajar memimpin dengan sabar"],
        next_focus: "Memberi kesempatan memimpin kelompok hafalan kecil.",
        profile: {
          overview: "Fadhil adalah anak yang santun dan tekun beribadah. Ia tumbuh menjadi pribadi yang semakin mandiri, dan paling bersemangat ketika merasa dipercaya. Ini gambaran periode ini, bukan vonis.",
          strengths: ["Santun", "Tekun beribadah", "Mau belajar mandiri", "Peduli teman"],
          best_approach: ["Beri tanggung jawab kecil yang jelas dan puji usahanya secara spesifik.", "Dengarkan ceritanya dulu sebelum memberi nasihat."],
        },
      }
    : {
        overview: "Aisyah adalah santri yang ceria, mudah bergaul, dan kini semakin teliti. Dalam sebulan terakhir ia belajar memeriksa kembali pekerjaannya dan lebih sabar, serta menunjukkan kepedulian kepada teman yang sedang kesulitan.",
        strengths: ["Mudah bergaul", "Penyemangat teman", "Peduli", "Mulai teliti"],
        growth_areas: ["Ketelitian di suasana ramai"],
        next_focus: "Menjaga ketelitian saat suasana ramai.",
        profile: {
          overview: "Aisyah ceria, hangat, dan pandai menyemangati teman. Ia belajar paling baik lewat contoh dan ajakan yang ringan. Ini gambaran periode ini, bukan vonis.",
          strengths: ["Ceria", "Hangat kepada teman", "Cepat beradaptasi"],
          best_approach: ["Ajak bicara santai; ia terbuka saat tidak merasa dinilai.", "Beri contoh bersikap sabar lewat cerita pengalaman sendiri."],
        },
      };
}

const monthOf = (iso: string) => monthKeyFromIso(iso)!;

async function seedReports(orgId: string, studentId: string, ustadzId: string, reports: DemoReport[], who: "fadhil" | "aisyah") {
  const { data: existing } = await db.from("reports").select("id").eq("student_id", studentId).limit(1);
  if (existing && existing.length > 0) {
    console.log("    reports already exist, skipped");
    return;
  }
  const stored: { created_at: string; treatment_plan: unknown }[] = [];
  const now = new Date().toISOString();

  const putContent = async (row: Record<string, unknown>, published: boolean) => {
    const { error } = await db.from("parent_contents").insert({
      organization_id: orgId, student_id: studentId, draft: row.content, model_used: "demo-seed",
      status: published ? "published" : "pending",
      reviewer_id: published ? ustadzId : null, reviewed_at: published ? now : null, published_at: published ? now : null,
      ...row,
    });
    if (error) throw error;
  };

  for (const [index, r] of reports.entries()) {
    const isLatest = index === reports.length - 1;
    const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000).toISOString();
    const priorityTheme = karakterData.themes[r.priority.theme];
    const plan = {
      report_title: r.title,
      status_summary: r.status_summary,
      analysis_version: 1,
      model_used: "demo-seed",
      overall_stats: { karakter: stat(r.stats[0]), mental: stat(r.stats[1]), soft_skill: stat(r.stats[2]) },
      detailed_assessments: r.picks.map(assessment),
      treatment: {
        priority_theme: priorityTheme.title,
        priority_indicator: priorityTheme.indicators[r.priority.indicator].title,
        target_sub_indicators: priorityTheme.indicators[r.priority.indicator].sub_indicators.slice(0, 2),
        action_plan: r.action_plan,
      },
    };
    stored.push({ created_at: createdAt, treatment_plan: plan });
    const { data: report, error } = await db
      .from("reports")
      .insert({
        student_id: studentId, organization_id: orgId, title: r.title,
        narrative: "[Data demo — tidak ada transkrip]", treatment_plan: plan,
        model_used: "demo-seed", created_by: ustadzId, created_at: createdAt,
      })
      .select("id")
      .single();
    if (error || !report) throw error ?? new Error("report insert failed");

    // Update cards. The newest report's cards wait in the musyrif's queue (demo of
    // the approval flow); older ones are already approved.
    const [paragraph1, paragraph2] = r.update.body.split("\n\n");
    await putContent({
      content_type: "update", kind: "kabar_baik", aspect: "karakter", report_id: report.id, created_at: createdAt,
      content: { text: `${paragraph1} ${r.update.highlights[0] ? r.update.highlights[0] + "." : ""}`.trim(), actions: [r.update.home_tip], focus: null, duration: null },
    }, !isLatest);
    await putContent({
      content_type: "update", kind: "didampingi", aspect: "soft_skill", report_id: report.id, created_at: createdAt,
      // One demo draft is flagged sensitive so the "contact the parent first" path can be shown.
      sensitive: who === "aisyah" && isLatest,
      sensitive_reason: who === "aisyah" && isLatest ? "Contoh demo: menyangkut dinamika dengan teman sekamar." : null,
      content: { text: paragraph2 ?? r.update.focus_area, actions: [r.update.home_tip], focus: r.update.focus_area, duration: "2 minggu" },
    }, !isLatest);
  }

  // Monthly summaries (trend labels computed in code) + character profile.
  const s = summaryFor(who);
  const months = Array.from(new Set(stored.map((x) => monthOf(x.created_at))));
  for (const [i, month] of months.entries()) {
    const isLastMonth = i === months.length - 1;
    const trends = computeTrends(stored, monthBounds(month));
    await putContent({
      content_type: "summary", period_key: month,
      content: { overview: s.overview, strengths: s.strengths, growth_areas: s.growth_areas, next_focus: s.next_focus, trends },
    }, !isLastMonth || months.length === 1);
  }
  await putContent({ content_type: "profile", content: s.profile }, true);
  console.log(`    ${reports.length} reports, cards, ${months.length} monthly summary draft(s) and profile created`);
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
  const linked = [ids["IP001"], ids["IP002"]];
  const { error: linkErr } = await db.from("parent_student_links").upsert(
    linked.map((student_id) => ({ organization_id: orgId, parent_id: parentId, student_id })),
    { onConflict: "parent_id,student_id", ignoreDuplicates: true },
  );
  if (linkErr) throw linkErr;
  // Demo parent has already accepted the data-use consent so the dashboard opens directly.
  await db.from("parent_consents").upsert({ parent_id: parentId, version: PARENT_CONSENT_VERSION }, { onConflict: "parent_id,version" });
  await db.from("profiles").update({ phone: "081200000000" }).eq("id", ustadzId);
  for (const nis of Object.keys(ids)) await db.from("students").update({ class_name: "7A" }).eq("id", ids[nis]);
  console.log("Parent account ready, linked to IP001 + IP002");

  console.log("  IP001 Fadhil:"); await seedReports(orgId, ids["IP001"], ustadzId, FADHIL_REPORTS, "fadhil");
  console.log("  IP002 Aisyah:"); await seedReports(orgId, ids["IP002"], ustadzId, AISYAH_REPORTS, "aisyah");

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
