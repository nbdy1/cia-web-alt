"use server";

import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase-server";

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

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return { success: false, error: listError.message };

  const user = users.find((u) => u.email === email);
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

export type OrgMember = {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

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

  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const roleRank: Record<string, number> = { owner: 0, admin: 1, ustadz: 2 };

  const merged: OrgMember[] = (members ?? [])
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      name: byId.get(m.user_id)?.name ?? null,
      email: byId.get(m.user_id)?.email ?? null,
    }))
    .sort((a, b) => (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9));

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
    if ((count ?? 0) <= 1) {
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
