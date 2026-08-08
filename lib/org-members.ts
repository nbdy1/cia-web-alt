/**
 * lib/org-members.ts
 *
 * Pure business-rule helpers for organization membership, pulled out of
 * app/actions/super-admin.ts so they're unit-testable without a live
 * Supabase service-role client (that module constructs one from env vars at
 * import time) — and because a "use server" file may only export async
 * server actions, not plain functions, so these couldn't live there anyway.
 */

export const ORG_ROLES = ["owner", "admin", "ustadz"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type OrgMember = {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  created_at: string;
};

// The "what makes a valid new-account submission" rule for the super-admin's
// "Create Account" form — kept as one testable place so any future
// loosening/tightening of it is covered by a regression test.
export function validateCreateOrgUserInput(input: {
  name: string;
  email: string;
  password: string;
  organizationId: string;
  role: string;
}): { valid: true; normalizedEmail: string } | { valid: false; error: string } {
  const normalizedEmail = input.email.trim().toLowerCase();
  const valid =
    !!input.name.trim() &&
    !!normalizedEmail &&
    input.password.length >= 6 &&
    !!input.organizationId &&
    (ORG_ROLES as readonly string[]).includes(input.role);
  if (!valid) {
    return { valid: false, error: "Nama, email, password minimal 6 karakter, organisasi, dan role wajib diisi." };
  }
  return { valid: true, normalizedEmail };
}

// The last owner of an organization can't be removed — otherwise the org is
// left with no one who can manage membership. `ownerCount` is the number of
// owner rows found for the org (including the member being considered).
export function canRemoveOwner(ownerCount: number): boolean {
  return ownerCount > 1;
}

// Joins organization_members rows with their profiles (name/email may be
// missing if the profile row was deleted) and sorts owner-first, matching
// how the "Manage Members" modal expects the list ordered.
export function mergeMembersWithProfiles(
  members: { user_id: string; role: string; created_at: string }[],
  profiles: { id: string; name: string | null; email: string | null }[],
): OrgMember[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const roleRank: Record<string, number> = { owner: 0, admin: 1, ustadz: 2 };
  return members
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      name: byId.get(m.user_id)?.name ?? null,
      email: byId.get(m.user_id)?.email ?? null,
    }))
    .sort((a, b) => (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9));
}
