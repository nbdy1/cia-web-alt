/**
 * Create or update a confirmed Supabase Auth user and attach them to one or
 * more organizations.
 *
 * Usage:
 *   npx tsx scripts/admin/create-org-user.ts \
 *     --name "Ahmad Fauzan" \
 *     --email ahmad@example.com \
 *     --password "change-me-123" \
 *     --role ustadz \
 *     --org-id 0bc3db16-d270-42d9-893a-c233a6b83800
 *
 * Multiple organizations:
 *   --org-id <id> --org-id <id>
 *   --org-id <id>,<id>
 *   --org-ids <id>,<id>
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type OrgRole = "ustadz" | "admin" | "owner";

type CliOptions = {
  name: string;
  email: string;
  password: string;
  role: OrgRole;
  orgIds: string[];
};

const VALID_ROLES = new Set<OrgRole>(["ustadz", "admin", "owner"]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function usage() {
  console.log(`
Usage:
  npx tsx scripts/admin/create-org-user.ts \\
    --name "Display Name" \\
    --email user@example.com \\
    --password "secure-password" \\
    --role ustadz|admin|owner \\
    --org-id <organization-uuid> [--org-id <organization-uuid>]

Alternatives:
  --org-id <organization-uuid>,<organization-uuid>
  --org-ids <organization-uuid>,<organization-uuid>
`);
}

function parseOrgIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function formatError(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    const fields = ["name", "message", "code", "details", "hint", "status", "__isAuthError"]
      .filter((key) => record[key] !== undefined && record[key] !== null)
      .map((key) => `${key}: ${String(record[key])}`);

    if (record.cause !== undefined && record.cause !== null) {
      fields.push(`cause: ${formatError(record.cause)}`);
    }

    const ownProps = Object.getOwnPropertyNames(error)
      .filter((key) => {
        if (["name", "message", "code", "details", "hint", "status", "__isAuthError", "cause"].includes(key)) {
          return false;
        }
        const value = record[key];
        return value !== undefined && value !== null;
      })
      .map((key) => `${key}: ${String(record[key])}`);

    fields.push(...ownProps);

    const symbols = Object.getOwnPropertySymbols(error)
      .filter((key) => {
        const value = (error as Record<symbol, unknown>)[key];
        return value !== undefined && value !== null;
      })
      .map((key) => `${String(key)}: ${String((error as Record<symbol, unknown>)[key])}`);

    fields.push(...symbols);

    if (fields.length > 0) return fields.join("\n");

    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {}
  }

  return String(error);
}

function authCreateHint(errorText: string) {
  if (
    errorText.includes("AuthRetryableFetchError") &&
    errorText.includes("status: 500")
  ) {
    return [
      "",
      "Likely cause: a database trigger failed during Supabase Auth user creation.",
      "In this project, check public.ensure_default_organization_membership().",
      "If the database still looks up slug 'sekolah-impian', run:",
      "  scripts/migrations/20260714_default_org_slug_sekolahimpian.sql",
    ].join("\n");
  }

  return "";
}

async function step<T>(label: string, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    const formatted = formatError(error);
    throw new Error(`${label} failed\n${formatted}${authCreateHint(formatted)}`);
  }
}

function readValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(args: string[]): CliOptions {
  const parsed: Partial<CliOptions> & { orgIds: string[] } = { orgIds: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--name") {
      parsed.name = readValue(args, i, arg).trim();
      i++;
      continue;
    }

    if (arg === "--email") {
      parsed.email = readValue(args, i, arg).trim().toLowerCase();
      i++;
      continue;
    }

    if (arg === "--password") {
      parsed.password = readValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === "--role") {
      const role = readValue(args, i, arg).trim().toLowerCase();
      if (!VALID_ROLES.has(role as OrgRole)) {
        throw new Error(`Invalid --role "${role}". Use ustadz, admin, or owner.`);
      }
      parsed.role = role as OrgRole;
      i++;
      continue;
    }

    if (arg === "--org-id") {
      parsed.orgIds.push(...parseOrgIds(readValue(args, i, arg)));
      i++;
      continue;
    }

    if (arg === "--org-ids") {
      parsed.orgIds.push(...parseOrgIds(readValue(args, i, arg)));
      i++;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.name) throw new Error("Missing --name");
  if (!parsed.email) throw new Error("Missing --email");
  if (!parsed.password) throw new Error("Missing --password");
  if (!parsed.role) throw new Error("Missing --role");
  if (parsed.orgIds.length === 0) throw new Error("Missing --org-id or --org-ids");

  return {
    name: parsed.name,
    email: parsed.email,
    password: parsed.password,
    role: parsed.role,
    orgIds: Array.from(new Set(parsed.orgIds)),
  };
}

async function findUserIdByEmail(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;

  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

async function getOrCreateConfirmedUser(options: CliOptions) {
  const existingUserId = await findUserIdByEmail(options.email);

  if (existingUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUserId,
      {
        email: options.email,
        password: options.password,
        email_confirm: true,
        user_metadata: { name: options.name, role: options.role },
      },
    );

    if (error) throw error;
    if (!data.user) throw new Error(`Failed to update user ${options.email}`);
    return { userId: data.user.id, created: false };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: options.email,
    password: options.password,
    email_confirm: true,
    user_metadata: { name: options.name, role: options.role },
  });

  if (error) throw error;
  if (!data.user) throw new Error(`Failed to create user ${options.email}`);

  return { userId: data.user.id, created: true };
}

async function assertOrganizationsExist(orgIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug")
    .in("id", orgIds);

  if (error) throw error;

  const found = new Map((data ?? []).map((org) => [org.id, org]));
  const missing = orgIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw new Error(`Organization id(s) not found: ${missing.join(", ")}`);
  }

  return orgIds.map((id) => found.get(id)!);
}

async function upsertProfile(options: CliOptions, userId: string) {
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      name: options.name,
      email: options.email,
      role: options.role,
      organization_id: options.orgIds[0],
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

async function upsertMemberships(options: CliOptions, userId: string) {
  const rows = options.orgIds.map((organizationId) => ({
    organization_id: organizationId,
    user_id: userId,
    role: options.role,
  }));

  const { error } = await supabaseAdmin
    .from("organization_members")
    .upsert(rows, { onConflict: "organization_id,user_id" });

  if (error) throw error;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const orgs = await step("Organization lookup", () =>
    assertOrganizationsExist(options.orgIds),
  );
  const { userId, created } = await step("Auth user create/update", () =>
    getOrCreateConfirmedUser(options),
  );

  await step("Profile upsert", () => upsertProfile(options, userId));
  await step("Membership upsert", () => upsertMemberships(options, userId));

  console.log(created ? "Created confirmed auth user." : "Updated existing auth user.");
  console.log(`User ID : ${userId}`);
  console.log(`Name    : ${options.name}`);
  console.log(`Email   : ${options.email}`);
  console.log(`Role    : ${options.role}`);
  console.log("Organizations:");
  orgs.forEach((org) => {
    console.log(`  - ${org.name} (${org.slug}) ${org.id}`);
  });
}

main().catch((error) => {
  console.error("Failed to create organization user:");
  console.error(formatError(error));
  usage();
  process.exit(1);
});
