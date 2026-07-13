/**
 * proxy.ts
 *
 * Refreshes the Supabase session on every app request and enforces production
 * tenant hosts for characterdev.systems. Localhost remains path-only so local
 * development does not require tenant DNS.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_ORG_COOKIE,
  TENANT_SLUG_COOKIE,
  getTenantHost,
  tenantCookieOptions,
  tenantUrl,
} from "@/lib/tenant";

type OrgMembership = {
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

function getOrg(row: OrgMembership) {
  return Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;
}

function getOrgSlug(row: OrgMembership) {
  const org = getOrg(row);
  return org?.slug || null;
}

function getOrgId(row: OrgMembership) {
  return getOrg(row)?.id ?? null;
}

function nextWithRequest(request: NextRequest) {
  return NextResponse.next({ request });
}

function chooseDefaultOrg(rows: OrgMembership[]) {
  const rank: Record<string, number> = { owner: 0, admin: 1, ustadz: 2 };
  return [...rows]
    .filter((row) => getOrgId(row))
    .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9))[0];
}

export async function proxy(request: NextRequest) {
  const tenantHost = getTenantHost(request.headers.get("host"));
  const cookieOptions = tenantCookieOptions();
  const requestHeaders = new Headers(request.headers);

  let supabaseResponse = nextWithRequest(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...cookieOptions,
            }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  requestHeaders.set("x-cia-tenant-host", tenantHost.hostname);
  if (tenantHost.slug) {
    requestHeaders.set("x-cia-tenant-slug", tenantHost.slug);
    supabaseResponse.cookies.set(
      TENANT_SLUG_COOKIE,
      tenantHost.slug,
      cookieOptions,
    );
  }

  if (!user || !tenantHost.isProductionDomain) {
    return supabaseResponse;
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, slug)")
    .eq("user_id", user.id);

  const rows = (memberships ?? []) as unknown as OrgMembership[];
  const hostOrg = tenantHost.slug
    ? rows.find((row) => getOrgSlug(row) === tenantHost.slug)
    : null;

  const hostOrgId = hostOrg ? getOrgId(hostOrg) : null;

  if (hostOrgId) {
    supabaseResponse.cookies.set(
      ACTIVE_ORG_COOKIE,
      hostOrgId,
      cookieOptions,
    );
    return supabaseResponse;
  }

  const defaultOrg = chooseDefaultOrg(rows);
  const defaultSlug = defaultOrg ? getOrgSlug(defaultOrg) : null;

  if (defaultSlug && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(
      tenantUrl(defaultSlug, request.nextUrl.pathname, request.url),
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
