/**
 * Service-role user creation for organization admins.
 *
 * This bypasses normal Supabase signup email/SMPP limits by using the Admin
 * API with email_confirm: true. The caller is still checked with their JWT and
 * must be owner/admin in every organization they are assigning.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OrgRole = "ustadz" | "admin" | "owner";

const VALID_ROLES = new Set<OrgRole>(["ustadz", "admin", "owner"]);

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function getUserClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

async function findUserIdByEmail(
  adminClient: ReturnType<typeof getAdminClient>,
  email: string,
) {
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const userClient = getUserClient(token);
    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "").trim().toLowerCase() as OrgRole;
    const orgIds = Array.from(
      new Set(
        (Array.isArray(body.orgIds) ? body.orgIds : [body.organizationId])
          .map((id: unknown) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (!name || !email || !password || orgIds.length === 0 || !VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const adminClient = getAdminClient();

    const { data: callerMemberships, error: callerMembershipError } =
      await adminClient
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", caller.id)
        .in("organization_id", orgIds)
        .in("role", ["owner", "admin"]);

    if (callerMembershipError) throw callerMembershipError;

    const allowedOrgIds = new Set(
      (callerMemberships ?? []).map((membership) => membership.organization_id),
    );
    const forbiddenOrgIds = orgIds.filter((id) => !allowedOrgIds.has(id));

    if (forbiddenOrgIds.length > 0) {
      return NextResponse.json(
        { error: "Forbidden: caller is not an owner/admin in every target organization" },
        { status: 403 },
      );
    }

    const existingUserId = await findUserIdByEmail(adminClient, email);
    let userId = existingUserId;

    if (existingUserId) {
      const { data, error } = await adminClient.auth.admin.updateUserById(
        existingUserId,
        {
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role },
        },
      );
      if (error) throw error;
      userId = data.user.id;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        name,
        email,
        role,
        organization_id: orgIds[0],
        is_removed: false,
        removed_at: null,
        removed_reason: null,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    const { error: memberError } = await adminClient
      .from("organization_members")
      .upsert(
        orgIds.map((organizationId) => ({
          organization_id: organizationId,
          user_id: userId,
          role,
        })),
        { onConflict: "organization_id,user_id" },
      );
    if (memberError) throw memberError;

    return NextResponse.json({
      success: true,
      userId,
      created: !existingUserId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
