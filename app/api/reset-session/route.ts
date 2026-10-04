/**
 * app/api/reset-session/route.ts
 *
 * Self-service fix for a stuck or stale browser session. Expires every Supabase
 * auth cookie (`sb-*`) and the app's own `cia_*` cookies, then sends the user to
 * /login.
 *
 * Why this exists: auth cookies were once host-only and later became
 * domain-wide (`.characterdev.systems`, see lib/tenant.ts), and their encoding
 * changed to "tokens-only". A browser that still holds an old copy next to the
 * new one can send both, and server-rendered pages (e.g. /students/[id]) may
 * read the stale one while client-side pages keep working. Users cannot be
 * expected to find and clear cookies themselves, so we do it for them.
 *
 * Lives under /api so proxy.ts (whose matcher skips /api) cannot refresh the
 * session and re-set the very cookies we are clearing.
 */
import { NextResponse } from "next/server";
import { APP_DOMAIN, normalizeHostname } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const CLEARABLE = /^(sb-|cia_)/;

function expire(name: string, domain?: string) {
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const names = Array.from(
    new Set(
      cookieHeader
        .split(";")
        .map((part) => part.split("=")[0].trim())
        .filter((name) => CLEARABLE.test(name)),
    ),
  );

  const host = normalizeHostname(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );

  // A cookie is only removed by a Set-Cookie with the same name, path AND
  // domain it was created with, so expire each name for every variant we have
  // ever issued: host-only, current host, and the shared parent domain.
  const domains: (string | undefined)[] = [undefined];
  if (host && host !== "localhost") domains.push(host);
  domains.push(`.${APP_DOMAIN}`);

  // Relative Location: this app sits behind a tunnel/pm2, so request.url may
  // carry an internal host. The browser resolves "/login" against the real one.
  const response = new NextResponse(null, { status: 302, headers: { Location: "/login" } });
  response.headers.set("Cache-Control", "no-store");
  for (const name of names) {
    for (const domain of domains) {
      response.headers.append("Set-Cookie", expire(name, domain));
    }
  }

  return response;
}
