/**
 * lib/supabase.ts
 *
 * Initialises the shared Supabase JS client used throughout the app.
 * Both the anon key and URL are exposed to the browser (NEXT_PUBLIC_*), which
 * is fine — Supabase Row-Level-Security policies enforce access on the server.
 *
 * Import `supabase` from here wherever you need to query the database or call
 * Supabase Auth from client or server code.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);