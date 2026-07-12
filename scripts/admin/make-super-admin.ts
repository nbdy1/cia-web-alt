import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Initialize Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function makeSuperAdmin(email: string, note: string) {
  console.log(`Looking up user with email: ${email}...`);

  // 1. Get the user by email using the Admin API
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  console.log(`Found user ID: ${user.id}`);
  console.log("Inserting into public.platform_admins...");

  // 2. Grant access via the platform_admins table — this is the SAME source
  // of truth the super-admin pages and server actions check via
  // is_platform_admin(). See lib/hooks/use-platform-admin.ts.
  const { error: upsertError } = await supabaseAdmin
    .from('platform_admins')
    .upsert({ user_id: user.id, note }, { onConflict: 'user_id' });

  if (upsertError) {
    console.error("Failed to insert into platform_admins:", upsertError.message);
    process.exit(1);
  }

  console.log("✅ Success! User is now a platform (company) Super Admin.");
  console.log("Note: The user will need to log out and log back in for the changes to take effect on the client side.");
}

const args = process.argv.slice(2);
const emailArg = args[0];
const noteArg = args[1] ?? 'founder';

if (!emailArg) {
  console.log("Usage: npx tsx scripts/admin/make-super-admin.ts <user-email> [note]");
  process.exit(1);
}

makeSuperAdmin(emailArg, noteArg);
