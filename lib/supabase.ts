/**
 * lib/supabase.ts
 *
 * Backward-compat shim. Existing client components import `supabase` from here.
 * We now delegate to the @supabase/ssr browser client so auth tokens are stored
 * in cookies (not localStorage) and properly shared with the server.
 */
import { createClient } from '@/lib/supabase/client';

// Singleton so we don't create a new client on every import
export const supabase = createClient();