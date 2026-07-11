/**
 * scripts/seed-test-org-users.ts
 *
 * Seeds test data for the 3 given organizations so multi-tenant scoping can
 * be tested end-to-end (admin dashboards, ustadz assignment, etc.):
 *   - 3 ustadz accounts per org (1 "admin" role + 2 "ustadz" role)
 *   - 15 santri per org, split 5-per-teacher across the 3 accounts above
 *
 * All accounts use the password "password" and are pre-confirmed (no email
 * verification needed) via the Supabase Admin API — this is test-only data,
 * never use this pattern for real user creation.
 *
 * Idempotent: re-running is safe. Existing auth users (matched by email) are
 * reused instead of erroring, and org membership / student inserts use
 * upsert / existence checks so nothing gets duplicated.
 *
 * Usage:
 *   npx tsx scripts/seed-test-org-users.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = 'password';

const ORGS = [
  { id: '0bc3db16-d270-42d9-893a-c233a6b83800', name: 'SMA Bakti Mulya 400 - Jakarta Selatan', slug: 'sma-bm400-jaksel' },
  { id: '60934e6c-0f30-4797-b3c8-694bd9267ca0', name: 'Saintek UHAMKA Boarding School - Bogor', slug: 'smp-sma-saintek-ubs-bogor' },
  { id: 'cde16fd0-691d-4343-bacd-19c24cec6041', name: 'Limau Bendi School', slug: 'lbs' },
] as const;

// 9 distinct, fitting Islamic teacher names — 3 consumed per org, in order.
const USTADZ_NAMES = [
  'Ahmad Fauzan Hidayat',
  'Muhammad Rizki Ramadhan',
  'Yusuf Maulana Firdaus',
  'Ibrahim Zainal Abidin',
  'Umar Faruq Setiawan',
  'Bilal Hamzah Nugraha',
  'Khalid Ridwan Santoso',
  'Faisal Syarif Wijaya',
  'Abdullah Rasyid Pratama',
];

// 45 distinct santri names — 15 consumed per org, in order. Mixed gender,
// as a pesantren roster naturally would be.
const SANTRI_NAMES = [
  'Ahmad Dzaki Firmansyah', 'Aisyah Putri Ramadhani', 'Yusuf Al-Farisi', 'Fatimah Az-Zahra Kurniawan',
  'Ibrahim Naufal Saputra', 'Khadijah Nur Aini', 'Umar Rafi Pratama', 'Zainab Salsabila Wibowo',
  'Hasan Fathan Nugraha', 'Maryam Nabila Santoso', 'Husein Arkan Wijaya', 'Hafsah Zahra Setiawan',
  'Zaid Rayyan Firdaus', 'Ruqayyah Alya Ramadhan', 'Faiz Akmal Hidayat', 'Aminah Hanifah Maulana',
  'Bilal Dafa Kurniawan', 'Qonita Rahmawati Putri', 'Hamzah Fajar Santoso', 'Nafisa Zahra Pratama',
  'Khalid Ridho Wijaya', 'Salsabila Aulia Nugraha', 'Farhan Aditya Firdaus', 'Aisyah Zahira Setiawan',
  'Malik Ihsan Ramadhan', 'Zahra Amelia Wibowo', 'Rasyid Danish Saputra', 'Nabila Syifa Kurniawan',
  'Fauzan Ammar Pratama', 'Hafizah Putri Maulana', 'Syarif Naufal Santoso', 'Alya Rahma Firdaus',
  'Ridwan Akbar Nugraha', 'Zainab Fadhila Wijaya', 'Dzaki Zuhair Hidayat', 'Nazwa Kamila Setiawan',
  'Faris Habibi Ramadhan', 'Qanita Aulia Kurniawan', 'Rafi Athallah Saputra', 'Hanifah Zulfa Pratama',
  'Naufal Zaidan Wibowo', 'Sarah Zahrani Maulana', 'Arkan Bagas Santoso', 'Alifah Nur Firdaus',
  'Fathan Al-Ghifari Nugraha',
];

let ustadzCursor = 0;
let santriCursor = 0;

function nextUstadzName(): string {
  const name = USTADZ_NAMES[ustadzCursor % USTADZ_NAMES.length];
  ustadzCursor++;
  return name;
}

function nextSantriName(): string {
  const name = SANTRI_NAMES[santriCursor % SANTRI_NAMES.length];
  santriCursor++;
  return name;
}

function slugifyEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

/** Reuses an existing auth user by email instead of failing on re-runs. */
async function getOrCreateUser(email: string, name: string, role: string) {
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (!createErr && created.user) return created.user.id;

  if (createErr && /already been registered|already exists/i.test(createErr.message)) {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) return existing.id;
  }

  throw createErr ?? new Error(`Failed to create or find user ${email}`);
}

async function seedOrg(org: (typeof ORGS)[number]) {
  console.log(`\n=== ${org.name} (${org.slug}) ===`);

  const roles: Array<'admin' | 'ustadz'> = ['admin', 'ustadz', 'ustadz'];
  const teachers: { id: string; name: string; role: string }[] = [];

  for (let i = 0; i < 3; i++) {
    const name = nextUstadzName();
    const role = roles[i];
    const email = `${slugifyEmail(name)}.${org.slug}@ciatest.id`;

    const userId = await getOrCreateUser(email, name, role);

    // Keep the profile in sync with the intended name/role — createUser's
    // metadata only seeds the profile on first creation via the auth
    // trigger, and re-runs / pre-existing rows won't reflect it otherwise.
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, name, email, role }, { onConflict: 'id' });
    if (profileErr) console.error(`  ✗ profile upsert failed for ${email}:`, profileErr.message);

    // The auth trigger auto-enrolls new profiles into a hardcoded default
    // org — explicitly (re-)enroll into the CORRECT org here.
    const { error: memberErr } = await supabaseAdmin
      .from('organization_members')
      .upsert({ organization_id: org.id, user_id: userId, role }, { onConflict: 'organization_id,user_id' });
    if (memberErr) console.error(`  ✗ membership upsert failed for ${email}:`, memberErr.message);

    teachers.push({ id: userId, name, role });
    console.log(`  ustadz  : ${name.padEnd(28)} role=${role.padEnd(6)} <${email}>`);
  }

  for (let i = 0; i < 15; i++) {
    const teacher = teachers[Math.floor(i / 5)];
    const name = nextSantriName();
    const nis = `${org.slug.replace(/-/g, '').slice(0, 6).toUpperCase()}${String(i + 1).padStart(3, '0')}`;

    const { data: existing } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('organization_id', org.id)
      .eq('nis', nis)
      .maybeSingle();

    if (existing) {
      console.log(`  santri  : ${name.padEnd(28)} NIS=${nis} (already exists, skipped)`);
      continue;
    }

    const { error: studentErr } = await supabaseAdmin.from('students').insert({
      name,
      nis,
      organization_id: org.id,
      assigned_ustadz_id: teacher.id,
    });

    if (studentErr) {
      console.error(`  ✗ santri ${name} failed:`, studentErr.message);
    } else {
      console.log(`  santri  : ${name.padEnd(28)} NIS=${nis} -> ${teacher.name}`);
    }
  }
}

async function main() {
  for (const org of ORGS) {
    await seedOrg(org);
  }
  console.log(`\nDone. All seeded accounts use password: "${TEST_PASSWORD}"`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
