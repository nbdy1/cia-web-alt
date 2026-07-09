"use server";

import { createClient } from "@supabase/supabase-js";

// Initialize admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createOrganization(name: string, slug: string) {
  // 1. Insert organization
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({ name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (orgError) {
    console.error("Error creating org:", orgError);
    return { success: false, error: orgError.message };
  }

  // Return the newly created org so the UI can update
  return { success: true, organization: org };
}

export async function assignUserToOrganization(email: string, organizationId: string, role: string) {
  // 1. Find user ID by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return { success: false, error: listError.message };

  const user = users.find(u => u.email === email);
  if (!user) return { success: false, error: "User not found with that email." };

  // 2. Add to organization_members
  const { error: insertError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      role: role
    });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: "User is already a member of this organization." };
    }
    return { success: false, error: insertError.message };
  }

  return { success: true };
}
