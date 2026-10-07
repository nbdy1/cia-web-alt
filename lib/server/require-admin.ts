import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";

/**
 * Server-side guard for admin-only actions: signed in, on the right tenant, and an
 * owner/admin of the organization (checked by the database function the row-level
 * security policies use). Returns the user-scoped Supabase client.
 */
export async function requireOrganizationAdmin(organizationId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  await assertTenantOrganization(db, organizationId);
  const { data: isAdmin } = await db.rpc("is_organization_admin", { target_organization_id: organizationId });
  if (!isAdmin) throw new Error("Hanya admin yang dapat melihat atau mengubah ini.");
  return db;
}
