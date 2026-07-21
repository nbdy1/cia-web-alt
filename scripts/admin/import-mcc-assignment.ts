import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ORG_ID = "4afa5b61-ea96-4740-a7e6-76ec4299e5f8";
const INITIAL_PASSWORD = "password";
const inputPath = process.argv[2] ?? "/tmp/mcc-students.json";

type ImportRow = { sheet: string; row: number; name: string; mcc: string };
type Staff = { name: string; email: string };

const STAFF: Record<string, Staff> = {
  "Ustzh. Alfi Hidayati Hikmah": { name: "Ustazah Alfi Hidayati Hikmah", email: "najmazahra792@gmail.com" },
  "Ustzh. Alfiah Aulia": { name: "Alfiah Aulia", email: "alfiahaulia25@gmail.com" },
  "Ustzh. Amalina Zuhrotul Ula": { name: "Amalina Zuhrotul Ula", email: "amalina.zuhro@gmail.com" },
  "Ustzh. Auvia Azzahro Al-Sofwa": { name: "Ustadzah Auvia", email: "zahrvya@gmail.com" },
  "Ustzh. Maswarni Tuti Ulya": { name: "Maswarni Tuti Ulya", email: "ulyauul2109@gmail.com" },
  "Ustzh. Salwa": { name: "Ustadzah Salwa", email: "salwasalsabilahh@gmail.com" },
  "Ustzh. Siti Rahma Fauziah": { name: "Siti Rahma Fauziah", email: "rahmafzh010905@gmail.com" },
  "Ustzh. Siti Suharni": { name: "Ustadzah Siti Suharni", email: "suharni309@gmail.com" },
  "Ustzh. Suninatiq": { name: "Suninatiq Addina", email: "suniadina03@gmail.com" },
  "Ustzh. Suryani Adinda Putri": { name: "Suryani Adinda Putri", email: "suryaniadindap@gmail.com" },
  "Ust. Ade Erdin": { name: "Ade Erdin", email: "adeerdin01@gmail.com" },
  "Ust. Al Ghoibu Nuron": { name: "Al Ghoibu Nuron", email: "alnuron27@gmail.com" },
  "Ust. Al Husain Izzah": { name: "Al Husain Izzah", email: "husainizzah@gmail.com" },
  "Ust. Albab Ghozari": { name: "Albab Ghozari", email: "albab9883@gmail.com" },
  "Ust. Arif Purnomo": { name: "Arif Purnomo", email: "arifpurnawan603@gmail.com" },
  "Ust. Auliya Mujaddidsyah Mas'ud": { name: "Ustadz Auliya Mujaddid Syah", email: "mujaddidgeneral@gmail.com" },
  "Ust. Barrur Rhozi": { name: "Barrur Rhozi", email: "barrurrhozi@gmail.com" },
  "Ust. Dzakiy Ihsan Syakur": { name: "Dzakiy Ihsan Syakur", email: "dzakiy74@gmail.com" },
  "Ust. Feri Firmansyah": { name: "Ust Feri Firmansyah", email: "ferifaiq89@gmail.com" },
  "Ust. Ismail Efendi": { name: "Ismail Efendi", email: "efendiismail857@gmail.com" },
  "Ust. Lalu Faozan Hadi": { name: "Lalu Faozan Hadi", email: "lalu.fauzan.hadi92@gmail.com" },
  "Ust. M. Asshalih Alfadzah": { name: "Muhammad As Shalih Alfadzah A.Md.Li", email: "asshalihmuhammad@gmail.com" },
  "Ust. M.Ahsanu Taqwim": { name: "M Ahsanu Taqwim", email: "mahsaan2810@gmail.com" },
  "Ust. Muh Khairun Arafah Mardin": { name: "Arafah", email: "khairunarafah@gmail.com" },
  "Ust. Muhamad Muckhlisin": { name: "Ustadz Muhamad Muckhlisin S.Pd", email: "mukhlis3009@gmail.com" },
  "Ust. Muhammad Adi Kusnanda": { name: "Ustadz Muhammad Adi", email: "karakter.impian@gmail.com" },
  "Ust. Muhammad Alwi": { name: "Muhammad Alwi", email: "hammada2911@gmail.com" },
  "Ust. Muhammad Fauzan Al Afghani": { name: "Muhammad Fauzan Al afghani S. Pd", email: "muhammadfauzanalafghani@gmail.com" },
  "Ust. Muhammad Rofiq": { name: "Muhammad Rofiq", email: "moh.rofiq123456@gmail.com" },
  "Ust. Suhendra Eko C": { name: "Ustadz Hendra", email: "suhendraekocahyono599@gmail.com" },
  "Ust. Suhermawan": { name: "Ustadz Hermawan", email: "suhermawan212@gmail.com" },
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase environment variables");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const rows = JSON.parse(fs.readFileSync(inputPath, "utf8")) as ImportRow[];
  const labels = [...new Set(rows.map((row) => row.mcc))];
  const missing = labels.filter((label) => !STAFF[label]);
  if (missing.length) throw new Error(`Missing MCC mapping: ${missing.join(", ")}`);

  const { data: existingProfiles, error: profileError } = await supabase
    .from("profiles").select("id,name,email,role").eq("organization_id", ORG_ID);
  if (profileError) throw profileError;
  const profileByEmail = new Map((existingProfiles ?? []).map((p) => [p.email.toLowerCase(), p]));

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw authError;
  const authByEmail = new Map((authData.users ?? []).flatMap((u) => u.email ? [[u.email.toLowerCase(), u] as const] : []));

  const userIds = new Map<string, string>();
  let created = 0;
  for (const staff of Object.values(STAFF)) {
    const email = staff.email.toLowerCase();
    const authUser = authByEmail.get(email);
    let userId = authUser?.id;
    if (!userId) {
      const result = await supabase.auth.admin.createUser({
        email, password: INITIAL_PASSWORD, email_confirm: true,
        user_metadata: { name: staff.name, role: "ustadz" },
      });
      if (result.error || !result.data.user) throw result.error ?? new Error(`Could not create ${email}`);
      userId = result.data.user.id;
      created++;
    } else {
      const result = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { name: staff.name, role: "ustadz" },
      });
      if (result.error) throw result.error;
    }
    userIds.set(email, userId);
    const profile = profileByEmail.get(email);
    const profileResult = await supabase.from("profiles").upsert({
      id: userId, name: staff.name, email, role: "ustadz", organization_id: ORG_ID,
    }, { onConflict: "id" });
    if (profileResult.error) throw profileResult.error;
    const membershipResult = await supabase.from("organization_members").upsert({
      organization_id: ORG_ID, user_id: userId, role: "ustadz",
    }, { onConflict: "organization_id,user_id" });
    if (membershipResult.error) throw membershipResult.error;
    console.log(`${profile ? "Updated" : "Ready"}: ${staff.name} <${email}> (${userId})`);
  }

  const { data: existingStudents, error: studentsError } = await supabase
    .from("students").select("id,name,assigned_ustadz_id").eq("organization_id", ORG_ID);
  if (studentsError) throw studentsError;
  const studentByName = new Map((existingStudents ?? []).map((s) => [s.name.trim().toLowerCase(), s]));
  let inserted = 0, reassigned = 0;
  for (const row of rows) {
    const staff = STAFF[row.mcc];
    const assignedId = userIds.get(staff.email.toLowerCase())!;
    const key = row.name.trim().toLowerCase();
    const existing = studentByName.get(key);
    if (existing) {
      const result = await supabase.from("students").update({ assigned_ustadz_id: assignedId }).eq("id", existing.id);
      if (result.error) throw result.error;
      if (existing.assigned_ustadz_id !== assignedId) reassigned++;
    } else {
      const result = await supabase.from("students").insert({ name: row.name.trim(), assigned_ustadz_id: assignedId, organization_id: ORG_ID });
      if (result.error) throw result.error;
      inserted++;
      studentByName.set(key, { id: "", name: row.name.trim(), assigned_ustadz_id: assignedId });
    }
  }
  console.log(JSON.stringify({ staff: Object.keys(STAFF).length, created, students: rows.length, inserted, reassigned }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
