export const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN?.toLowerCase() || "characterdev.systems";

export const ACTIVE_ORG_COOKIE = "cia_active_organization";
export const TENANT_SLUG_COOKIE = "cia_tenant_slug";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RESERVED_SUBDOMAINS = new Set(["www", "app"]);

export type TenantHost = {
  hostname: string;
  slug: string | null;
  isApex: boolean;
  isProductionDomain: boolean;
};

export function normalizeHostname(host: string | null | undefined) {
  return (host ?? "")
    .split(":")[0]
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
}

export function getTenantHost(host: string | null | undefined): TenantHost {
  const hostname = normalizeHostname(host);
  const isLocal = LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
  const isApex = hostname === APP_DOMAIN || hostname === `www.${APP_DOMAIN}`;
  const isProductionDomain =
    !isLocal && (isApex || hostname.endsWith(`.${APP_DOMAIN}`));

  let slug: string | null = null;
  if (isProductionDomain && hostname.endsWith(`.${APP_DOMAIN}`) && !isApex) {
    slug = hostname.slice(0, -(APP_DOMAIN.length + 1));
    if (RESERVED_SUBDOMAINS.has(slug)) slug = null;
  }

  return { hostname, slug, isApex, isProductionDomain };
}

export function tenantCookieOptions() {
  return {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    path: "/",
    domain: process.env.NODE_ENV === "production" ? `.${APP_DOMAIN}` : undefined,
  };
}

export function browserTenantCookieOptions() {
  return {
    expires: 365,
    sameSite: "lax" as const,
    path: "/",
    ...(process.env.NODE_ENV === "production"
      ? { domain: `.${APP_DOMAIN}` }
      : {}),
  };
}

export function tenantUrl(slug: string, pathname = "/", currentUrl?: string) {
  const base = currentUrl ? new URL(currentUrl) : null;
  const protocol = base?.protocol ?? "https:";
  const url = new URL(`${protocol}//${slug}.${APP_DOMAIN}`);
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (base) url.search = base.search;
  if (base) url.hash = base.hash;
  return url;
}

export function getTenantSwitchUrl(
  currentHost: string,
  targetSlug: string,
  currentPathname = "/",
  currentUrl?: string,
) {
  const tenantHost = getTenantHost(currentHost);
  if (!tenantHost.isProductionDomain || tenantHost.slug === targetSlug) {
    return null;
  }

  return tenantUrl(targetSlug, currentPathname, currentUrl).toString();
}
