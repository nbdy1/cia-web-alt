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

async function makeSuperAdmin(email: string) {
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
  console.log("Updating user metadata to set is_super_admin: true...");

  // 2. Update user metadata
  const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { user_metadata: { ...user.user_metadata, is_super_admin: true } }
  );

  if (updateError) {
    console.error("Failed to update user:", updateError.message);
    process.exit(1);
  }

  console.log("✅ Success! User is now a Super Admin.");
  console.log("Note: The user will need to log out and log back in for the changes to take effect on the client side.");
}

const args = process.argv.slice(2);
const emailArg = args[0];

if (!emailArg) {
  console.log("Usage: npx tsx scripts/admin/make-super-admin.ts <user-email>");
  process.exit(1);
}

makeSuperAdmin(emailArg);
