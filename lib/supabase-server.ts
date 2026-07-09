import { cookies } from "next/headers";

import { createSupabaseWithAccessToken, SUPABASE_ACCESS_TOKEN_COOKIE } from "@/lib/supabase-auth";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value ?? null;
  return createSupabaseWithAccessToken(accessToken);
}
