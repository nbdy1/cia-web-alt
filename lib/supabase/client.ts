/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client using @supabase/ssr.
 * This stores auth tokens in cookies (not localStorage), so they are
 * automatically available to server components and server actions.
 * This is the client to use in all "use client" components.
 */
import { createBrowserClient } from '@supabase/ssr';
import { tenantCookieOptions } from '@/lib/tenant';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Persist auth cookies across browser restarts and, in production,
      // across all organization tenant hosts under characterdev.systems.
      cookieOptions: tenantCookieOptions(),
    }
  );
}
