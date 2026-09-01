/**
 * Change a Supabase Auth user's password by email.
 *
 * Usage:
 *   npx tsx scripts/admin/change-password.ts \
 *     --email user@example.com \
 *     --password "new-password"
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function valueAfter(args: string[], flag: string) {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      'Usage: npx tsx scripts/admin/change-password.ts --email user@example.com --password "new-password"',
    );
    return;
  }

  const email = valueAfter(args, "--email").trim().toLowerCase();
  const password = valueAfter(args, "--password");

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;

  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) throw new Error(`No Auth user found for ${email}`);

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
  });
  if (updateError) throw updateError;

  console.log(`Password updated for ${email} (${user.id}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
