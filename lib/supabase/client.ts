/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client using @supabase/ssr.
 * This stores auth tokens in cookies (not localStorage), so they are
 * automatically available to server components and server actions.
 * This is the client to use in all "use client" components.
 */
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_COOKIE_ENCODING, tenantCookieOptions } from '@/lib/tenant';

export function createClient() {
  // Client modules can be evaluated while Next prerenders a route. There is no
  // document.cookie in that phase, so provide an inert cookie store there;
  // real browser requests still use Supabase's document.cookie adapter.
  const isServerRender = typeof window === "undefined";
  const cookieConfig = isServerRender
    ? {
        encode: SUPABASE_COOKIE_ENCODING,
        getAll: () => [],
        setAll: () => {},
      }
    : { encode: SUPABASE_COOKIE_ENCODING };

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Persist auth cookies across browser restarts and, in production,
      // across all organization tenant hosts under characterdev.systems.
      cookieOptions: tenantCookieOptions(),
      cookies: cookieConfig,
      // @supabase/ssr uses window.localStorage to cache the user when
      // tokens-only encoding is enabled. Give prerendering a no-op cache;
      // browser requests retain its default localStorage-backed cache.
      auth: isServerRender
        ? {
            userStorage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
          }
        : undefined,
    }
  );
}
