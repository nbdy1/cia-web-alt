"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type OrganizationAppMode = "cds" | "bp";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Persists one user's preferred workspace for one organization. */
export async function setUserAppMode(
  organizationId: string,
  mode: OrganizationAppMode,
) {
  if (mode !== "cds" && mode !== "bp") {
    return { success: false, error: "Mode aplikasi tidak valid." };
  }

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { success: false, error: "Silakan masuk kembali." };

  await assertTenantOrganization(db, organizationId);

  const { data: membership, error: membershipError } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { success: false, error: "Keanggotaan institusi tidak ditemukan." };
  }

  // Membership RLS intentionally permits administration only to admins. Use
  // the service client after authenticating the caller so every user can
  // change only their own display/workflow preference, never someone else's.
  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({ app_mode: mode })
    .eq("organization_id", organizationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}
