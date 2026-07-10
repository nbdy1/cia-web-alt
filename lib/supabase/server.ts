/**
 * lib/supabase/server.ts
 *
 * Server-side Supabase client using @supabase/ssr.
 * Reads and writes auth cookies using Next.js cookies() so the user's
 * session is always respected in Server Components, Server Actions, and
 * Route Handlers — regardless of which domain the app is deployed on.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Match the browser client so refreshed cookies stay persistent across
      // browser restarts instead of being downgraded to session cookies.
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components where mutation is not allowed.
            // Middleware will refresh the session cookie instead, so we can safely ignore this.
          }
        },
      },
    }
  );
}
