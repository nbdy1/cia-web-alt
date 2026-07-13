import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantHost } from "@/lib/tenant";

type MembershipRow = {
  role: string;
  organizations:
    | {
        id: string;
        slug: string;
      }
    | {
        id: string;
        slug: string;
      }[]
    | null;
};

function getOrg(row: MembershipRow) {
  return Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;
}

export async function getRequestTenant() {
  const headerStore = await headers();
  return getTenantHost(
    headerStore.get("x-cia-tenant-host") ?? headerStore.get("host"),
  );
}

export async function getAuthenticatedTenantOrgId(db: SupabaseClient) {
  const tenant = await getRequestTenant();
  if (!tenant.isProductionDomain || !tenant.slug) return null;

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data } = await db
    .from("organization_members")
    .select("role, organizations(id, slug)")
    .eq("user_id", user.id);

  const rows = (data ?? []) as unknown as MembershipRow[];
  const match = rows.find(
    (row) =>
      getOrg(row) &&
      getOrg(row)!.slug === tenant.slug,
  );

  return (match ? getOrg(match)?.id : null) ?? "__forbidden__";
}

export async function assertTenantOrganization(
  db: SupabaseClient,
  organizationId: string | null | undefined,
) {
  const tenantOrgId = await getAuthenticatedTenantOrgId(db);
  if (tenantOrgId && tenantOrgId !== organizationId) {
    throw new Error("Forbidden: organization does not match current tenant");
  }
}

export async function isTenantOrganization(
  db: SupabaseClient,
  organizationId: string | null | undefined,
) {
  const tenantOrgId = await getAuthenticatedTenantOrgId(db);
  return !tenantOrgId || tenantOrgId === organizationId;
}
