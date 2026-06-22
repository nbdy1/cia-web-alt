/**
 * scripts/seed_ustadz_accounts.js
 *
 * Creates Supabase auth accounts + profiles for 12 ustadz/ustazah,
 * then seeds 5 students per ustadz (gender-matched) and assigns them.
 *
 * REQUIREMENTS:
 *   1. Get your service role key from:
 *      Supabase Dashboard → Settings → API → "service_role" (secret key)
 *   2. Paste it into SUPABASE_SERVICE_ROLE_KEY below.
 *   3. Run:  node scripts/seed_ustadz_accounts.js
 *
 * Default password for every account: Pesantren2024!
 * (Remind all ustadz to change their password on first login.)
 */

import { createClient } from "@supabase/supabase-js";

// ─── CONFIG — fill these in ───────────────────────────────────────────────────
const SUPABASE_URL      = "https://ydtgcxfcjxpkpqtxukns.supabase.co";
const SERVICE_ROLE_KEY  = "PASTE_YOUR_SERVICE_ROLE_KEY_HERE"; // ← replace this
const DEFAULT_PASSWORD  = "Pesantren2026!";
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Ustadz / Ustazah list ───────────────────────────────────────────────────
// gender: "f" = female (Ustazah), "m" = male (Ustadz)
const STAFF = [
  { firstName: "Yaumi",   gender: "f" },
  { firstName: "Siti",    gender: "f" },
  { firstName: "Nuraini", gender: "f" },
  { firstName: "Alfi",    gender: "f" },
  { firstName: "Ahsan",   gender: "m" },
  { firstName: "Auliya",  gender: "f" },
  { firstName: "Adi",     gender: "m" },
  { firstName: "Fery",    gender: "m" },
  { firstName: "Ismail",  gender: "m" },
  { firstName: "Fauzan",  gender: "m" },
  { firstName: "Wawan",   gender: "m" },
  { firstName: "Erdin",   gender: "m" },
];

// ─── Student name pools ───────────────────────────────────────────────────────
// 5 students per ustadz × 7 male + 5 female = 60 students total.
// Each pool is consumed in order; no duplicates across staff.

const FEMALE_STUDENTS = [
  // Ustazah Yaumi
  "Hafsah Salsabila", "Aisyah Rahmawati", "Fatimah Azzahra", "Khadijah Nurul Huda", "Zainab Fitriani",
  // Ustazah Siti
  "Maryam Khairunnisa", "Ruqayyah Afifah", "Ummu Kulsum Nabila", "Shafiyah Humaira", "Asma Fadhilah",
  // Ustazah Nuraini
  "Sumayyah Anindita", "Ramlah Putri Cahaya", "Nada Syarifah", "Laila Fitria", "Rizki Aulia",
  // Ustazah Alfi
  "Dina Kamila", "Intan Nadhifa", "Safiya Nur Izzah", "Hana Qonita", "Nisa Zahira",
  // Ustazah Auliya
  "Tsabitah Qurrotul Ain", "Najwa Salimah", "Izzah Muthmainnah", "Fadhilah Insyirah", "Safa Marwah",
];

const MALE_STUDENTS = [
  // Ustadz Ahsan
  "Muhammad Syafiq Arkan", "Ahmad Zaid Al-Farisi", "Abdullah Hanif Rizqullah", "Umar Ibrahim Fathoni", "Ali Muttaqin",
  // Ustadz Adi
  "Hasan Ashshidiq", "Husain Fadhlullah", "Yusuf Nasrullah", "Idris Zulkifli", "Bilal Hamdani",
  // Ustadz Fery
  "Hamzah Akbar Maulana", "Khalid Musyaffa", "Salman Fauzi Hakim", "Sufyan Saqib", "Musa Raihan",
  // Ustadz Ismail
  "Dawud Firdaus", "Sulaiman Muzakki", "Harun Mukhlis", "Yahya Dzikrullah", "Zakariya Mubarak",
  // Ustadz Fauzan
  "Aqil Naufal Habibie", "Rizal Thariq Aziz", "Fadhl Ghifari", "Bahri Kamal Prasetyo", "Nabil Furqon",
  // Ustadz Wawan
  "Rafi Mahdi Santoso", "Zaki Amsyar", "Anas Khairu Umam", "Irfan Tsaqif", "Jabir Hayyan",
  // Ustadz Erdin
  "Kholid Nazhif", "Luthfi Abrar Hakim", "Muadz Sulhan", "Nasir Taufiq Hidayat", "Osman Thariq",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTitle(gender) {
  return gender === "f" ? "Ustazah" : "Ustadz";
}

function getEmail(firstName) {
  return `${firstName.toLowerCase()}@pesantren.sch.id`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (SERVICE_ROLE_KEY === "PASTE_YOUR_SERVICE_ROLE_KEY_HERE") {
    console.error("❌  Please paste your Supabase service role key into SERVICE_ROLE_KEY before running.");
    process.exit(1);
  }

  let femaleIdx = 0;
  let maleIdx   = 0;

  for (const staff of STAFF) {
    const fullName = `${getTitle(staff.gender)} ${staff.firstName}`;
    const email    = getEmail(staff.firstName);

    console.log(`\n→ Creating account for ${fullName} (${email})`);

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: fullName },
    });

    if (authError) {
      console.error(`  ✗ Auth error for ${fullName}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    console.log(`  ✓ Auth user created: ${userId}`);

    // 2. Upsert profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, name: fullName, email, role: "ustadz" });

    if (profileError) {
      console.error(`  ✗ Profile error for ${fullName}:`, profileError.message);
      continue;
    }
    console.log(`  ✓ Profile created`);

    // 3. Insert 5 gender-matched students
    const pool    = staff.gender === "f" ? FEMALE_STUDENTS : MALE_STUDENTS;
    const idxRef  = staff.gender === "f" ? femaleIdx        : maleIdx;
    const students = pool.slice(idxRef, idxRef + 5).map((name) => ({
      name,
      assigned_ustadz_id: userId,
    }));

    if (staff.gender === "f") femaleIdx += 5;
    else                       maleIdx   += 5;

    const { error: studentError } = await supabase.from("students").insert(students);

    if (studentError) {
      console.error(`  ✗ Student insert error:`, studentError.message);
    } else {
      console.log(`  ✓ ${students.length} students added:`);
      students.forEach((s) => console.log(`      • ${s.name}`));
    }
  }

  console.log("\n✅  Done! All accounts and students created.");
  console.log(`\n📋  Default password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log("    Remind every ustadz/ustazah to change their password on first login.\n");
}

main().catch(console.error);
