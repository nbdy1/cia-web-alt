/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client using @supabase/ssr.
 * This stores auth tokens in cookies (not localStorage), so they are
 * automatically available to server components and server actions.
 * This is the client to use in all "use client" components.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Persist auth cookies for a year so the session survives closing the
        // tab/browser. Without an explicit maxAge these can behave like session
        // cookies and get cleared on browser close, bouncing the user to /login.
        // The refresh token keeps the session alive; middleware refreshes it.
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        path: '/',
      },
    }
  );
}
