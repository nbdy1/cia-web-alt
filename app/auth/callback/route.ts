/**
 * OAuth (Google) return URL. Exchanges the one-time code for a session cookie and
 * sends the user to "/", which routes parents to their dashboard and new Google
 * users without a child yet to /parent/link.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=google`);
  }
  return NextResponse.redirect(`${origin}/`);
}
