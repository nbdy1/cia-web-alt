"use server";

import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  validateCreateOrgUserInput,
  canRemoveOwner,
  mergeMembersWithProfiles,
  type OrgMember,
} from "@/lib/org-members";

// Service-role client bypasses RLS. Every action below is gated behind
// assertPlatformAdmin() so only company super-admins can use it.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Throws unless the caller is a platform (company) super-admin. Uses the
 * authenticated SSR client so it reads the real logged-in user; RLS on
 * platform_admins only lets an actual platform admin see rows.
 */
async function assertPlatformAdmin(): Promise<void> {
  const db = await getServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) throw new Error("Forbidden: platform super-admin only");
}

async function logAudit(action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  try {
    const db = await getServerSupabase();
    const { data: { user } } = await db.auth.getUser();
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: user?.id ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch (err) {
    console.error("[super-admin] audit log failed:", err);
  }
}

export async function createOrganization(name: string, slug: string) {
  try {
    await assertPlatformAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({ name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (orgError) {
    console.error("Error creating org:", orgError);
    return { success: false, error: orgError.message };
  }

  await logAudit("create_org", "organization", org.id, { name, slug });
  return { success: true, organization: org };
}

export async function assignUserToOrganization(email: string, organizationId: string, role: string) {
  try {
    await assertPlatformAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;
  let user: { id: string; email?: string } | undefined;
  while (!user) {
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (listError) return { success: false, error: listError.message };
    user = data.users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail);
    if (data.users.length < perPage) break;
    page += 1;
  }
  if (!user) return { success: false, error: "User not found with that email." };

  const { error: insertError } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: organizationId, user_id: user.id, role });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "User is already a member of this organization." };
    }
    return { success: false, error: insertError.message };
  }

  await logAudit("assign_member", "organization", organizationId, { email, role });
  return { success: true };
}

/** Create a fresh auth account and attach it to one organization. */
export async function createOrganizationUser(
  name: string,
  email: string,
  password: string,
  organizationId: string,
  role: string,
) {
  try {
    await assertPlatformAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const validation = validateCreateOrgUserInput({ name, email, password, organizationId, role });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  const { normalizedEmail } = validation;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name: name.trim(), role },
  });
  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Gagal membuat akun.' };
  }

  const userId = authData.user.id;
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    role,
    organization_id: organizationId,
    is_removed: false,
    removed_at: null,
    removed_reason: null,
  }, { onConflict: 'id' });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: profileError.message };
  }

  const { error: memberError } = await supabaseAdmin.from('organization_members').insert({
    organization_id: organizationId,
    user_id: userId,
    role,
  });
  if (memberError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: memberError.message };
  }

  // A legacy profile trigger may have created a membership in the default
  // organization while the profile was inserted. Keep this newly created
  // account scoped to the organization selected by the super admin.
  const { error: extraMembershipError } = await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('user_id', userId)
    .neq('organization_id', organizationId);
  if (extraMembershipError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: extraMembershipError.message };
  }

  await logAudit('create_org_user', 'organization', organizationId, { user_id: userId, email: normalizedEmail, role });
  return { success: true, userId };
}

export type { OrgMember };

/** List all members of an organization with their profile name/email. */
export async function getOrganizationMembers(
  organizationId: string,
): Promise<{ success: boolean; members?: OrgMember[]; error?: string }> {
  try {
    await assertPlatformAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const { data: members, error } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) return { success: false, error: error.message };

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", ids)
    : { data: [] as any[] };

  const merged = mergeMembersWithProfiles(members ?? [], profiles ?? []);

  return { success: true, members: merged };
}

/** Remove a member from an organization. Refuses to remove the last owner. */
export async function removeOrganizationMember(organizationId: string, userId: string) {
  try {
    await assertPlatformAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  const { data: target } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!target) return { success: false, error: "Member not found in this organization." };

  if (target.role === "owner") {
    const { count } = await supabaseAdmin
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "owner");
    if (!canRemoveOwner(count ?? 0)) {
      return { success: false, error: "Cannot remove the only owner. Assign another owner first." };
    }
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };

  await logAudit("remove_member", "organization", organizationId, { user_id: userId, role: target.role });
  return { success: true };
}
