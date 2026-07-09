/**
 * lib/supabase-server.ts
 *
 * Re-exports the server Supabase client creator for backward compat with
 * existing server actions that call getServerSupabase().
 */
import { createClient } from '@/lib/supabase/server';

export async function getServerSupabase() {
  return createClient();
}
