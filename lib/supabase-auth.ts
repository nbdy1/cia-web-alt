import { createClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export const SUPABASE_ACCESS_TOKEN_COOKIE = "cia-supabase-access-token";

export function createSupabaseWithAccessToken(accessToken?: string | null) {
  if (!accessToken) return supabase;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export async function getCurrentAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
